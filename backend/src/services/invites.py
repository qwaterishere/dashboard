"""Создание и погашение одноразовых ключей регистрации."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.security import hash_refresh_token
from src.db.models.invite import InviteKey

DEFAULT_TTL_DAYS = 14
INVALID_INVITE = "Invalid invite key"


def hash_invite_key(raw: str) -> str:
    """Тот же SHA-256, что у refresh-токенов — lookup по hash без plaintext в БД."""
    return hash_refresh_token(raw.strip())


def generate_invite_key() -> str:
    return secrets.token_urlsafe(24)


def create_invite(
    db: Session,
    *,
    ttl_days: int = DEFAULT_TTL_DAYS,
    note: str | None = None,
) -> tuple[str, InviteKey]:
    if ttl_days < 1:
        raise ValueError("ttl_days must be >= 1")

    raw = generate_invite_key()
    invite = InviteKey(
        key_hash=hash_invite_key(raw),
        note=(note.strip() if note else None) or None,
        expires_at=datetime.now(UTC) + timedelta(days=ttl_days),
    )
    db.add(invite)
    db.flush()
    return raw, invite


def consume_invite(db: Session, raw_key: str, *, user_id: UUID) -> InviteKey:
    """Находит валидный ключ и помечает использованным. Иначе ValueError."""
    key_hash = hash_invite_key(raw_key)
    invite = db.scalar(select(InviteKey).where(InviteKey.key_hash == key_hash))
    now = datetime.now(UTC)

    if invite is None or invite.used_at is not None:
        raise ValueError(INVALID_INVITE)

    expires = invite.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires < now:
        raise ValueError(INVALID_INVITE)

    invite.used_at = now
    invite.used_by_user_id = user_id
    db.flush()
    return invite
