"""FastAPI dependencies."""

from __future__ import annotations

import hmac
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.cookies import read_access_cookie
from src.api.errors import http_error
from src.core.config import get_settings
from src.core.security import decode_access_token
from src.db.models.restaurant import Restaurant
from src.db.models.user import User
from src.db.session import get_db
from src.services.restaurant import get_or_create_restaurant

_bearer = HTTPBearer(auto_error=False)
_WWW_AUTH = {"WWW-Authenticate": "Bearer"}


def _resolve_access_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is not None and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return read_access_cookie(request)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    settings = get_settings()
    if not settings.auth_enabled:
        raise http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Authentication is disabled",
            "auth_disabled",
            request,
        )

    raw_token = _resolve_access_token(request, credentials)
    if raw_token is None:
        raise http_error(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated",
            "not_authenticated",
            request,
            headers=_WWW_AUTH,
        )

    try:
        payload = decode_access_token(raw_token)
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise http_error(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired token",
            "invalid_token",
            request,
            headers=_WWW_AUTH,
        ) from None

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise http_error(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired token",
            "invalid_token",
            request,
            headers=_WWW_AUTH,
        )

    token_version = payload.get("tv")
    if token_version is None or token_version != user.token_version:
        raise http_error(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired token",
            "invalid_token",
            request,
            headers=_WWW_AUTH,
        )
    return user


def get_current_restaurant(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Restaurant:
    return get_or_create_restaurant(db, user)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentRestaurant = Annotated[Restaurant, Depends(get_current_restaurant)]


def require_roles(*roles: str):
    """Dependency factory: CurrentUser must have one of the given roles."""

    allowed = frozenset(roles)

    def _check(request: Request, user: CurrentUser) -> User:
        role = getattr(user, "role", None) or "manager"
        if role not in allowed:
            raise http_error(
                status.HTTP_403_FORBIDDEN,
                "Insufficient role",
                "forbidden",
                request,
            )
        return user

    return _check


def verify_sync_scheduler_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    """Bearer-токен для worker/cron — отдельно от JWT пользователя."""
    settings = get_settings()
    expected = settings.sync_scheduler_token
    if not expected:
        raise http_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Sync scheduler is not configured",
            "sync_scheduler_not_configured",
            request,
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise http_error(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid scheduler token",
            "invalid_scheduler_token",
            request,
            headers=_WWW_AUTH,
        )
    if not hmac.compare_digest(credentials.credentials, expected):
        raise http_error(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid scheduler token",
            "invalid_scheduler_token",
            request,
            headers=_WWW_AUTH,
        )


__all__ = [
    "get_db",
    "get_current_user",
    "get_current_restaurant",
    "require_roles",
    "verify_sync_scheduler_token",
    "CurrentUser",
    "CurrentRestaurant",
]
