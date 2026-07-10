"""Политика паролей: строгая в production, мягкая в development."""

from __future__ import annotations

import re

from src.core.config import Settings

_UPPER = re.compile(r"[A-Z]")
_LOWER = re.compile(r"[a-z]")
_DIGIT = re.compile(r"\d")
_SPECIAL = re.compile(r"[^A-Za-z0-9]")


def password_min_length(settings: Settings) -> int:
    return 12 if settings.is_production else 8


def password_requires_complexity(settings: Settings) -> bool:
    return settings.is_production


def validate_password(password: str, settings: Settings) -> str:
    """Возвращает нормализованный пароль или бросает ValueError."""
    min_len = password_min_length(settings)
    if len(password) < min_len:
        raise ValueError(f"Password must be at least {min_len} characters long")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters long")

    if not password_requires_complexity(settings):
        return password

    missing: list[str] = []
    if not _UPPER.search(password):
        missing.append("an uppercase letter")
    if not _LOWER.search(password):
        missing.append("a lowercase letter")
    if not _DIGIT.search(password):
        missing.append("a digit")
    if not _SPECIAL.search(password):
        missing.append("a special character")

    if missing:
        raise ValueError(
            "Password must include " + ", ".join(missing),
        )
    return password
