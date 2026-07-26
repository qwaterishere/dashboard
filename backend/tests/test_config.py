"""Tests for application settings."""

import pytest
from pydantic import ValidationError

from src.core.config import Settings, get_settings, resolve_sqlite_url
from src.core.paths import BACKEND_ROOT

_PROD_SCHEDULER_TOKEN = "a" * 32


def test_resolve_sqlite_url_makes_backend_relative_path_absolute():
    resolved = resolve_sqlite_url("sqlite:///dashboard.db")
    assert resolved == f'sqlite:///{(BACKEND_ROOT / "dashboard.db").resolve()}'


def test_resolve_sqlite_url_keeps_absolute_path():
    absolute = "sqlite:////tmp/dashboard.db"
    assert resolve_sqlite_url(absolute) == absolute


def _production_env(monkeypatch, **extra: str) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_URL", "postgresql+psycopg://user:pass@localhost/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    monkeypatch.setenv("CREDENTIALS_ENCRYPTION_KEY", "y" * 32)
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("SYNC_EMBEDDED_WORKER", "false")
    monkeypatch.setenv("SYNC_RUN_IN_API", "false")
    monkeypatch.setenv("SYNC_SCHEDULER_TOKEN", _PROD_SCHEDULER_TOKEN)
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_STORAGE_URI", "memory://")
    monkeypatch.setenv("TRUSTED_PROXIES", "127.0.0.1")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
    for key, value in extra.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


def test_production_forbids_auth_disabled(monkeypatch):
    _production_env(monkeypatch, AUTH_ENABLED="false")
    with pytest.raises(ValidationError, match="AUTH_ENABLED must be true"):
        Settings()


def test_production_forbids_embedded_worker(monkeypatch):
    _production_env(monkeypatch, SYNC_EMBEDDED_WORKER="true")
    with pytest.raises(ValidationError, match="SYNC_EMBEDDED_WORKER must be false"):
        Settings()


def test_production_requires_credentials_encryption_key(monkeypatch):
    _production_env(monkeypatch)
    monkeypatch.delenv("CREDENTIALS_ENCRYPTION_KEY", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError, match="CREDENTIALS_ENCRYPTION_KEY is required"):
        Settings()


def test_production_defaults_log_json_true(monkeypatch):
    _production_env(monkeypatch)
    monkeypatch.delenv("LOG_JSON", raising=False)
    get_settings.cache_clear()
    settings = Settings()
    assert settings.log_json is True


def test_development_defaults_log_json_false(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DB_URL", "sqlite:///:memory:")
    monkeypatch.delenv("LOG_JSON", raising=False)
    get_settings.cache_clear()
    settings = Settings()
    assert settings.log_json is False


def test_cors_origins_reject_wildcard(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DB_URL", "sqlite:///:memory:")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:4200,*")
    get_settings.cache_clear()
    with pytest.raises(ValidationError, match="CORS_ORIGINS must not contain"):
        Settings()


def test_production_requires_rate_limit_enabled(monkeypatch):
    _production_env(monkeypatch, RATE_LIMIT_ENABLED="false")
    with pytest.raises(ValidationError, match="RATE_LIMIT_ENABLED must be true"):
        Settings()


def test_production_rejects_trusted_proxies_wildcard(monkeypatch):
    _production_env(monkeypatch, TRUSTED_PROXIES="*")
    with pytest.raises(ValidationError, match="TRUSTED_PROXIES must not contain"):
        Settings()


def test_production_requires_trusted_proxies(monkeypatch):
    _production_env(monkeypatch, TRUSTED_PROXIES="")
    with pytest.raises(ValidationError, match="TRUSTED_PROXIES is required"):
        Settings()


def test_production_requires_rate_limit_storage_uri(monkeypatch):
    _production_env(monkeypatch)
    monkeypatch.delenv("RATE_LIMIT_STORAGE_URI", raising=False)
    get_settings.cache_clear()
    with pytest.raises(ValidationError, match="RATE_LIMIT_STORAGE_URI is required"):
        Settings()


def test_production_allows_explicit_memory_rate_limit_storage(monkeypatch):
    _production_env(monkeypatch, RATE_LIMIT_STORAGE_URI="memory://")
    settings = Settings()
    assert settings.rate_limit_storage_uri == "memory://"


def test_production_forbids_sync_run_in_api(monkeypatch):
    _production_env(monkeypatch, SYNC_RUN_IN_API="true")
    with pytest.raises(ValidationError, match="SYNC_RUN_IN_API must be false"):
        Settings()


def test_development_defaults_sync_run_in_api_true(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DB_URL", "sqlite:///:memory:")
    monkeypatch.delenv("SYNC_RUN_IN_API", raising=False)
    get_settings.cache_clear()
    settings = Settings()
    assert settings.sync_run_in_api is True


def test_production_requires_sync_scheduler_token(monkeypatch):
    _production_env(monkeypatch, SYNC_SCHEDULER_TOKEN="")
    with pytest.raises(ValidationError, match="SYNC_SCHEDULER_TOKEN is required"):
        Settings()


def test_production_rejects_short_sync_scheduler_token(monkeypatch):
    _production_env(monkeypatch, SYNC_SCHEDULER_TOKEN="short-but-not-placeholder")
    with pytest.raises(ValidationError, match="at least 32 characters"):
        Settings()


def test_production_rejects_placeholder_sync_scheduler_token(monkeypatch):
    _production_env(
        monkeypatch,
        SYNC_SCHEDULER_TOKEN="your-long-random-secret-at-least-16-chars!!",
    )
    with pytest.raises(ValidationError, match="placeholder"):
        Settings()


def test_jwt_algorithm_must_be_hs256(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("DB_URL", "sqlite:///:memory:")
    monkeypatch.setenv("JWT_ALGORITHM", "none")
    get_settings.cache_clear()
    with pytest.raises(ValidationError, match="JWT_ALGORITHM must be"):
        Settings()


def test_production_requires_https_cors_origins(monkeypatch):
    _production_env(monkeypatch, CORS_ORIGINS="http://localhost:4200")
    with pytest.raises(ValidationError, match="CORS_ORIGINS must use https://"):
        Settings()


def test_production_accepts_https_cors(monkeypatch):
    _production_env(monkeypatch, CORS_ORIGINS="https://app.example.com")
    settings = Settings()
    assert settings.allowed_origins == ["https://app.example.com"]
