import ipaddress
import socket

import httpx
import pytest

from src.core.iiko_url import (
    assert_hostname_allowlisted,
    assert_safe_resolved_host,
    normalize_iiko_url,
    parse_allowed_suffixes,
    validate_iiko_url,
)
from src.integrations.iiko.client import IikoClient, reject_iiko_redirect_response
from src.integrations.iiko.exceptions import IikoBlockedHostError


def _public_addrinfo(*_args, **_kwargs):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]


def test_normalize_iiko_url_strips_slashes():
    assert normalize_iiko_url("https://demo.iiko.it:443///") == "https://demo.iiko.it:443"


def test_parse_allowed_suffixes_defaults_to_iiko_it():
    assert parse_allowed_suffixes(None) == (".iiko.it",)
    assert parse_allowed_suffixes("") == (".iiko.it",)
    assert parse_allowed_suffixes("  ") == (".iiko.it",)


def test_parse_allowed_suffixes_normalizes_entries():
    assert parse_allowed_suffixes("iiko.it,.example.com") == (".iiko.it", ".example.com")


def test_validate_accepts_allowlisted_https_shape():
    assert (
        validate_iiko_url("https://demo.iiko.it:443/", resolve_dns=False)
        == "https://demo.iiko.it:443"
    )


def test_validate_resolves_dns_when_enabled(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _public_addrinfo)
    assert validate_iiko_url("https://demo.iiko.it:443") == "https://demo.iiko.it:443"


@pytest.mark.parametrize(
    "url",
    [
        "http://demo.iiko.it:443",
        "ftp://demo.iiko.it",
        "https://",
        "https://user:pass@demo.iiko.it",
    ],
)
def test_validate_rejects_invalid_scheme_or_shape(url: str):
    with pytest.raises(ValueError):
        validate_iiko_url(url, resolve_dns=False)


@pytest.mark.parametrize(
    "host",
    [
        "127.0.0.1",
        "10.0.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "0.0.0.0",
        "[::1]",
        "[fe80::1]",
        "localhost",
        "metadata.google.internal",
    ],
)
def test_validate_rejects_private_or_restricted_hosts(host: str):
    with pytest.raises(ValueError):
        validate_iiko_url(f"https://{host}", resolve_dns=False)


def test_validate_rejects_non_allowlisted_public_host():
    with pytest.raises(ValueError, match="allowlist"):
        validate_iiko_url("https://evil.example.com", resolve_dns=False)


def test_validate_accepts_custom_allowlist_suffix():
    suffixes = (".example.com",)
    assert (
        validate_iiko_url(
            "https://iiko.example.com",
            resolve_dns=False,
            allowed_suffixes=suffixes,
        )
        == "https://iiko.example.com"
    )


def test_validate_rejects_public_ip_literal():
    with pytest.raises(ValueError, match="allowlisted host name"):
        validate_iiko_url("https://93.184.216.34", resolve_dns=False)


def test_validate_rejects_private_ip_literals():
    for ip in ipaddress.ip_network("10.0.0.0/8").hosts():
        with pytest.raises(ValueError):
            validate_iiko_url(f"https://{ip}", resolve_dns=False)
        break


def test_assert_hostname_allowlisted_matches_suffix():
    assert_hostname_allowlisted("demo.iiko.it", (".iiko.it",))
    assert_hostname_allowlisted("co.iiko.it", (".iiko.it",))


def test_assert_safe_resolved_host_accepts_public_ip(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", _public_addrinfo)
    assert_safe_resolved_host("demo.iiko.it")


def test_assert_safe_resolved_host_rejects_private_resolution(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))],
    )
    with pytest.raises(ValueError, match="private or reserved"):
        assert_safe_resolved_host("evil.example.com")


def test_reject_iiko_redirect_response_blocks_3xx():
    request = httpx.Request("GET", "https://demo.iiko.it/resto/api/auth")
    response = httpx.Response(302, headers={"location": "https://127.0.0.1/"}, request=request)
    with pytest.raises(IikoBlockedHostError, match="Redirects"):
        reject_iiko_redirect_response(response)


def test_iiko_client_blocks_non_allowlisted_host():
    with pytest.raises(IikoBlockedHostError):
        IikoClient(url="https://evil.example.com", login="api", password="secret")


def test_iiko_client_blocks_before_http(monkeypatch):
    monkeypatch.setattr(
        socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 0))],
    )

    with pytest.raises(IikoBlockedHostError):
        IikoClient(url="https://demo.iiko.it", login="api", password="secret")
