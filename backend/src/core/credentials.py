"""Шифрование tenant-specific секретов (iiko password) at rest.

Ключ шифрования — конфиг процесса (12-factor III), не per-tenant данные.
В dev допускается детерминированный fallback от JWT_SECRET_KEY.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from src.core.config import get_settings

_DEV_JWT_PLACEHOLDER = "dev-only-change-me-use-openssl-rand-hex-32"


def _fernet_key_from_secret(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _resolve_encryption_secret() -> str:
    settings = get_settings()
    if settings.credentials_encryption_key:
        return settings.credentials_encryption_key
    return settings.jwt_secret_key


def encrypt_secret(plaintext: str) -> str:
    secret = _resolve_encryption_secret()
    if get_settings().is_production and secret.startswith(_DEV_JWT_PLACEHOLDER):
        raise RuntimeError(
            "CREDENTIALS_ENCRYPTION_KEY or JWT_SECRET_KEY required for credential encryption",
        )
    fernet = Fernet(_fernet_key_from_secret(secret))
    return fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    secret = _resolve_encryption_secret()
    fernet = Fernet(_fernet_key_from_secret(secret))
    try:
        return fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt stored credentials") from exc
