"""Password policy and environment profile."""

import os

import pytest
from pydantic import ValidationError

from src.core.config import Settings, get_settings
from src.core.password_policy import validate_password


@pytest.mark.parametrize(
    "password",
    [
        "short1!",
        "nouppercase1!",
        "NOLOWERCASE1!",
        "NoDigits!!",
        "NoSpecial1",
    ],
)
def test_production_password_rejects_weak(password: str, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_URL", "postgresql+psycopg://user:pass@localhost/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    get_settings.cache_clear()

    settings = get_settings()
    with pytest.raises(ValueError):
        validate_password(password, settings)


def test_development_allows_simple_password(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DB_URL", "sqlite:///:memory:")
    get_settings.cache_clear()

    settings = get_settings()
    assert validate_password("TestPass123!", settings) == "TestPass123!"


def test_production_accepts_strong_password(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_URL", "postgresql+psycopg://user:pass@localhost/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    get_settings.cache_clear()

    settings = get_settings()
    assert validate_password("Str0ng!PassWord", settings) == "Str0ng!PassWord"


def test_production_rejects_sqlite(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_URL", "sqlite:///dashboard.db")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="SQLite is not permitted"):
        Settings()


def test_production_requires_db_url(monkeypatch):
    monkeypatch.setenv("DB_URL", "")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match="DB_URL is required"):
        Settings()


def test_development_defaults_to_sqlite(monkeypatch):
    monkeypatch.delenv("DB_URL", raising=False)
    monkeypatch.setenv("APP_ENV", "development")
    get_settings.cache_clear()

    settings = Settings()
    assert settings.db_url.startswith("sqlite:///")
