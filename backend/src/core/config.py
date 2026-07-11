"""Единая конфигурация приложения из окружения.

Все настройки, зависящие от среды выполнения, читаются здесь.

Локальная разработка: ``APP_ENV=development`` (по умолчанию) — SQLite, мягкие пароли,
без HSTS. Production: ``APP_ENV=production`` — PostgreSQL, строгие секреты, HSTS, сложные пароли.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.core.paths import BACKEND_ROOT

AppEnv = Literal["development", "production"]

_DEV_JWT_PLACEHOLDER = "dev-only-change-me-use-openssl-rand-hex-32"


def resolve_sqlite_url(db_url: str) -> str:
    """Относительный sqlite:///file.db → абсолютный путь в backend/.

    Иначе uvicorn и CLI, запущенные из разных cwd, читают разные файлы.
    После пересоздания dashboard.db работающий uvicorn может держать старый inode.
    """
    if not db_url.startswith("sqlite:///"):
        return db_url
    if db_url in ("sqlite:///:memory:", "sqlite://"):
        return db_url
    path_part = db_url.removeprefix("sqlite:///")
    if not path_part or path_part.startswith("/"):
        return db_url
    return f"sqlite:///{(BACKEND_ROOT / path_part).resolve()}"


class Settings(BaseSettings):
    """Конфигурация web-процесса и CLI-утилит."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: AppEnv = Field(default="development", validation_alias="APP_ENV")

    db_url: str | None = Field(default=None, validation_alias="DB_URL")

    # --- HTTP / безопасность ---
    cors_origins: str = Field(
        default="http://localhost:4200",
        validation_alias="CORS_ORIGINS",
    )
    rate_limit: str = Field(default="60/minute", validation_alias="RATE_LIMIT")
    rate_limit_enabled: bool = Field(default=True, validation_alias="RATE_LIMIT_ENABLED")
    hsts_enabled: bool | None = Field(default=None, validation_alias="HSTS_ENABLED")
    hsts_max_age: int = Field(default=31_536_000, validation_alias="HSTS_MAX_AGE", ge=0)

    # --- JWT / авторизация ---
    jwt_secret_key: str = Field(
        default=_DEV_JWT_PLACEHOLDER,
        validation_alias="JWT_SECRET_KEY",
        min_length=32,
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(
        default=15,
        validation_alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
        ge=1,
        le=60,
    )
    jwt_refresh_token_expire_days: int = Field(
        default=7,
        validation_alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS",
        ge=1,
        le=90,
    )
    jwt_cookie_secure: bool = Field(default=False, validation_alias="JWT_COOKIE_SECURE")
    auth_enabled: bool = Field(default=True, validation_alias="AUTH_ENABLED")

    # Ключ шифрования tenant-секретов (iiko password). В prod — отдельный секрет.
    credentials_encryption_key: str | None = Field(
        default=None,
        validation_alias="CREDENTIALS_ENCRYPTION_KEY",
        min_length=32,
    )

    # --- iiko REST API: fallback для CLI/dev (12-factor XII admin process) ---
    iiko_url: str | None = Field(default=None, validation_alias="IIKO_URL")
    iiko_login: str | None = Field(default=None, validation_alias="IIKO_LOGIN")
    iiko_password: str | None = Field(default=None, validation_alias="IIKO_PASSWORD")
    iiko_url_allowed_suffixes: str = Field(
        default=".iiko.it",
        validation_alias="IIKO_URL_ALLOWED_SUFFIXES",
    )

    @field_validator("db_url", mode="before")
    @classmethod
    def empty_db_url_to_none(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        return value

    @field_validator("db_url", mode="after")
    @classmethod
    def normalize_db_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return resolve_sqlite_url(value)

    @model_validator(mode="after")
    def apply_environment_profile(self) -> Settings:
        if self.db_url is None:
            if self.is_production:
                raise ValueError(
                    "DB_URL is required when APP_ENV=production "
                    "(use PostgreSQL, e.g. postgresql+psycopg://user:pass@host/db)",
                )
            object.__setattr__(self, "db_url", resolve_sqlite_url("sqlite:///dashboard.db"))

        if self.is_production and self.db_url.startswith("sqlite"):
            raise ValueError(
                "SQLite is not permitted when APP_ENV=production; set DB_URL to PostgreSQL",
            )

        if self.is_production and self.jwt_secret_key.startswith("dev-only-change-me"):
            raise ValueError(
                "JWT_SECRET_KEY must be a strong unique secret when APP_ENV=production",
            )

        if self.hsts_enabled is None:
            object.__setattr__(self, "hsts_enabled", self.is_production)

        if self.is_production and not self.jwt_cookie_secure:
            raise ValueError(
                "JWT_COOKIE_SECURE must be true when APP_ENV=production",
            )

        return self

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    def require_iiko(self) -> tuple[str, str, str]:
        """Credentials для CLI; явная ошибка, если не заданы в окружении."""
        from src.core.iiko_url import validate_iiko_url

        missing = [
            name
            for name, val in (
                ("IIKO_URL", self.iiko_url),
                ("IIKO_LOGIN", self.iiko_login),
                ("IIKO_PASSWORD", self.iiko_password),
            )
            if not val
        ]
        if missing:
            raise RuntimeError(f"Missing env: {', '.join(missing)}")
        url = validate_iiko_url(self.iiko_url)  # type: ignore[arg-type]
        return url, self.iiko_login, self.iiko_password  # type: ignore[return-value]

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
