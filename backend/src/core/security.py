"""Криптография: пароли (Argon2id), JWT access, opaque refresh + хэш в БД."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from src.core.config import get_settings

_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

INVALID_CREDENTIALS = "Invalid email or password"


def hash_password(plain: str) -> str:
    return _password_hasher.hash(plain)


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, plain)
    except VerifyMismatchError:
        return False


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_access_token(*, user_id: UUID, email: str) -> tuple[str, int]:
    settings = get_settings()
    expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    expire = datetime.now(UTC) + expires_delta
    payload = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, int(expires_delta.total_seconds())


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Invalid token type")
    return payload


def refresh_token_expires_at() -> datetime:
    settings = get_settings()
    return datetime.now(UTC) + timedelta(days=settings.jwt_refresh_token_expire_days)
