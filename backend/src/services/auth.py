"""Регистрация, вход, refresh rotation, logout."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.security import (
    INVALID_CREDENTIALS,
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    normalize_email,
    refresh_token_expires_at,
    verify_password,
)
from src.db.models.user import RefreshToken, User
from src.schemas.auth import RegisterRequest, TokenResponse, UserPublic

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class AuthError(HTTPException):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)


def user_to_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        position=user.position,
        created_at=user.created_at,
    )


def _invalidate_access_tokens(user: User) -> None:
    user.token_version += 1


def _issue_token_pair(db: Session, user: User) -> tuple[TokenResponse, str]:
    access_token, expires_in = create_access_token(
        user_id=user.id,
        email=user.email,
        token_version=user.token_version,
    )
    raw_refresh = generate_refresh_token()
    family_id = uuid.uuid4()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            family_id=family_id,
            expires_at=refresh_token_expires_at(),
        )
    )
    db.commit()
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in,
    ), raw_refresh


def register_user(db: Session, payload: RegisterRequest) -> tuple[TokenResponse, str, UserPublic]:
    email = normalize_email(payload.email)
    exists = db.scalar(select(User.id).where(User.email == email))
    if exists is not None:
        raise AuthError(status.HTTP_409_CONFLICT, "Registration failed")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        position=payload.position,
    )
    db.add(user)
    db.flush()
    tokens, raw_refresh = _issue_token_pair(db, user)
    return tokens, raw_refresh, user_to_public(user)


def login_user(db: Session, email: str, password: str) -> tuple[TokenResponse, str, UserPublic]:
    normalized = normalize_email(email)
    user = db.scalar(select(User).where(User.email == normalized))
    if user is None or not verify_password(password, user.password_hash):
        raise AuthError(status.HTTP_401_UNAUTHORIZED, INVALID_CREDENTIALS)
    if not user.is_active:
        raise AuthError(status.HTTP_403_FORBIDDEN, "Account is disabled")

    tokens, raw_refresh = _issue_token_pair(db, user)
    return tokens, raw_refresh, user_to_public(user)


def _revoke_family(db: Session, family_id: uuid.UUID) -> None:
    now = _utc_now()
    tokens = db.scalars(
        select(RefreshToken).where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
    ).all()
    for token in tokens:
        token.revoked_at = now


def refresh_session(db: Session, raw_refresh: str) -> tuple[TokenResponse, str]:
    token_hash = hash_refresh_token(raw_refresh)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    now = _utc_now()

    if stored is None:
        raise AuthError(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    if stored.revoked_at is not None:
        _revoke_family(db, stored.family_id)
        user = db.get(User, stored.user_id)
        if user is not None:
            _invalidate_access_tokens(user)
        db.commit()
        logger.warning("Refresh token reuse detected for family %s", stored.family_id)
        raise AuthError(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    if _as_utc(stored.expires_at) < now:
        stored.revoked_at = now
        db.commit()
        raise AuthError(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        stored.revoked_at = now
        db.commit()
        raise AuthError(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    stored.revoked_at = now
    new_raw = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(new_raw),
            family_id=stored.family_id,
            expires_at=refresh_token_expires_at(),
        )
    )
    access_token, expires_in = create_access_token(
        user_id=user.id,
        email=user.email,
        token_version=user.token_version,
    )
    db.commit()
    return TokenResponse(access_token=access_token, expires_in=expires_in), new_raw


def logout_user(db: Session, raw_refresh: str | None) -> None:
    if not raw_refresh:
        return
    token_hash = hash_refresh_token(raw_refresh)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored is None:
        return
    user = db.get(User, stored.user_id)
    if stored.revoked_at is None:
        stored.revoked_at = _utc_now()
    if user is not None:
        _invalidate_access_tokens(user)
        db.commit()
