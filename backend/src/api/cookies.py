"""HttpOnly auth cookies (access + refresh)."""

from __future__ import annotations

from typing import Literal

from starlette.responses import Response

from src.core.config import Settings, get_settings

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
ACCESS_COOKIE_PATH = "/api"
REFRESH_COOKIE_PATH = "/api/auth"

SameSiteValue = Literal["lax", "strict"]


def auth_cookie_samesite(settings: Settings | None = None) -> SameSiteValue:
    resolved = settings or get_settings()
    return "strict" if resolved.is_production else "lax"


def set_access_cookie(response: Response, token: str, *, expires_in: int) -> None:
    settings = get_settings()
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=token,
        httponly=True,
        secure=settings.jwt_cookie_secure,
        samesite=auth_cookie_samesite(settings),
        path=ACCESS_COOKIE_PATH,
        max_age=expires_in,
    )


def clear_access_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=ACCESS_COOKIE,
        path=ACCESS_COOKIE_PATH,
        httponly=True,
        secure=settings.jwt_cookie_secure,
        samesite=auth_cookie_samesite(settings),
    )


def set_refresh_cookie(response: Response, raw_refresh: str) -> None:
    settings = get_settings()
    max_age = settings.jwt_refresh_token_expire_days * 24 * 60 * 60
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_refresh,
        httponly=True,
        secure=settings.jwt_cookie_secure,
        samesite=auth_cookie_samesite(settings),
        path=REFRESH_COOKIE_PATH,
        max_age=max_age,
    )


def clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.jwt_cookie_secure,
        samesite=auth_cookie_samesite(settings),
    )


def read_refresh_cookie(request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE)


def read_access_cookie(request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE)
