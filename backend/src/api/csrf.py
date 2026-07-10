"""CSRF mitigation for cookie-authenticated state-changing auth requests."""

from __future__ import annotations

from urllib.parse import urlparse

from fastapi import HTTPException, Request, status

from src.core.config import get_settings


def _origin_allowed(origin: str, allowed: set[str]) -> bool:
    return origin.rstrip("/") in allowed


def _referer_allowed(referer: str, allowed: set[str]) -> bool:
    parsed = urlparse(referer)
    if not parsed.scheme or not parsed.netloc:
        return False
    candidate = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    return candidate in allowed


def assert_trusted_origin(request: Request) -> None:
    """Reject cross-site POSTs that carry auth cookies (production requires Origin/Referer)."""
    settings = get_settings()
    allowed = {origin.rstrip("/") for origin in settings.allowed_origins}

    origin = request.headers.get("origin")
    if origin:
        if not _origin_allowed(origin, allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid origin")
        return

    referer = request.headers.get("referer")
    if referer and _referer_allowed(referer, allowed):
        return

    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Origin required",
        )
