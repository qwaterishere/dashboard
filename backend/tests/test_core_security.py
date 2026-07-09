"""Password hashing and JWT helpers."""

import pytest
from uuid import uuid4

from src.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_password_hash_and_verify():
    hashed = hash_password("SecretPass123")
    assert verify_password("SecretPass123", hashed)
    assert not verify_password("wrong", hashed)


def test_access_token_roundtrip():
    user_id = uuid4()
    token, expires_in = create_access_token(user_id=user_id, email="u@example.com")
    assert expires_in > 0
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == "u@example.com"
    assert payload["type"] == "access"


def test_refresh_token_hash_is_deterministic():
    assert hash_refresh_token("abc") == hash_refresh_token("abc")
    assert hash_refresh_token("abc") != hash_refresh_token("def")
