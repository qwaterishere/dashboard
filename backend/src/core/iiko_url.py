"""Политика URL iiko: https-only, allowlist, DNS blocklist (SSRF mitigation)."""

from __future__ import annotations

import ipaddress
import socket
from collections.abc import Sequence
from urllib.parse import urlparse

_DEFAULT_ALLOWED_SUFFIXES: tuple[str, ...] = (".iiko.it",)

_BLOCKED_HOSTNAMES = frozenset(
    {
        "localhost",
        "metadata.google.internal",
        "metadata.goog",
    },
)


def normalize_iiko_url(url: str) -> str:
    return url.strip().rstrip("/")


def parse_allowed_suffixes(raw: str | None) -> tuple[str, ...]:
    """Парсит `IIKO_URL_ALLOWED_SUFFIXES` (через запятую). Пустое → `.iiko.it`."""
    if raw is None or not raw.strip():
        return _DEFAULT_ALLOWED_SUFFIXES

    suffixes: list[str] = []
    for item in raw.split(","):
        normalized = item.strip().lower()
        if not normalized:
            continue
        if not normalized.startswith("."):
            normalized = f".{normalized}"
        suffixes.append(normalized)

    return tuple(suffixes) if suffixes else _DEFAULT_ALLOWED_SUFFIXES


def get_iiko_url_allowed_suffixes() -> tuple[str, ...]:
    from src.core.config import get_settings

    return parse_allowed_suffixes(get_settings().iiko_url_allowed_suffixes)


def iiko_hostname_from_url(url: str) -> str:
    hostname = urlparse(normalize_iiko_url(url)).hostname
    if not hostname:
        raise ValueError("iiko URL must include a valid host")
    return hostname


def is_blocked_hostname(host: str) -> bool:
    return host.lower() in _BLOCKED_HOSTNAMES


def is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _try_ip_address(value: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(value)
    except ValueError:
        return None


def assert_safe_ip_address(ip_str: str) -> None:
    ip = ipaddress.ip_address(ip_str)
    if is_blocked_ip(ip):
        raise ValueError("iiko URL must not point to a private or reserved address")


def assert_hostname_allowlisted(
    hostname: str,
    allowed_suffixes: Sequence[str],
) -> None:
    """Host должен совпадать с suffix-allowlist; IP-литералы запрещены."""
    host = hostname.lower().strip().rstrip(".")

    if _try_ip_address(host) is not None:
        raise ValueError("iiko URL must use an allowlisted host name, not an IP address")

    for suffix in allowed_suffixes:
        normalized = suffix.lower() if suffix.startswith(".") else f".{suffix.lower()}"
        bare = normalized.lstrip(".")
        if host == bare or host.endswith(normalized):
            return

    raise ValueError("iiko URL host is not in the allowlist")


def assert_safe_resolved_host(hostname: str) -> None:
    """DNS lookup + blocklist — защита от rebinding между save и HTTP-запросом."""
    host = hostname.lower().strip()
    if is_blocked_hostname(host):
        raise ValueError("iiko URL must not point to a restricted host")

    if _try_ip_address(host) is not None:
        assert_safe_ip_address(host)
        return

    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("iiko host could not be resolved") from exc

    if not infos:
        raise ValueError("iiko host could not be resolved")

    seen: set[str] = set()
    for info in infos:
        sockaddr = info[4]
        if not sockaddr:
            continue
        ip_str = sockaddr[0]
        if ip_str in seen:
            continue
        seen.add(ip_str)
        assert_safe_ip_address(ip_str)


def validate_iiko_url(
    url: str,
    *,
    resolve_dns: bool = True,
    allowed_suffixes: Sequence[str] | None = None,
) -> str:
    """Нормализует URL или бросает ValueError с безопасным сообщением для API."""
    normalized = normalize_iiko_url(url)
    parsed = urlparse(normalized)

    if parsed.scheme != "https":
        raise ValueError("iiko URL must use https")
    if not parsed.hostname:
        raise ValueError("iiko URL must include a valid host")
    if parsed.username or parsed.password:
        raise ValueError("iiko URL must not include embedded credentials")

    host = parsed.hostname.lower()
    if is_blocked_hostname(host):
        raise ValueError("iiko URL must not point to a restricted host")

    ip = _try_ip_address(host)
    if ip is not None and is_blocked_ip(ip):
        raise ValueError("iiko URL must not point to a private or reserved address")

    suffixes = allowed_suffixes if allowed_suffixes is not None else get_iiko_url_allowed_suffixes()
    assert_hostname_allowlisted(host, suffixes)

    if resolve_dns:
        assert_safe_resolved_host(host)

    return normalized
