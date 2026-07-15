"""FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.cookies import read_access_cookie
from src.core.config import get_settings
from src.core.security import decode_access_token
from src.db.models.restaurant import Restaurant
from src.db.models.user import User
from src.db.session import get_db
from src.services.restaurant import get_or_create_restaurant

_bearer = HTTPBearer(auto_error=False)


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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is disabled",
        )

    raw_token = _resolve_access_token(request, credentials)
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(raw_token)
        user_id = UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_version = payload.get("tv")
    if token_version is None or token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_restaurant(
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Restaurant:
    return get_or_create_restaurant(db, user)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentRestaurant = Annotated[Restaurant, Depends(get_current_restaurant)]


def verify_sync_scheduler_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    """Bearer-токен для worker/cron — отдельно от JWT пользователя."""
    settings = get_settings()
    expected = settings.sync_scheduler_token
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sync scheduler is not configured",
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid scheduler token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if credentials.credentials != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid scheduler token",
            headers={"WWW-Authenticate": "Bearer"},
        )


__all__ = [
    "get_db",
    "get_current_user",
    "get_current_restaurant",
    "verify_sync_scheduler_token",
    "CurrentUser",
    "CurrentRestaurant",
]
