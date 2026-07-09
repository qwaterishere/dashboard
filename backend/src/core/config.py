"""Единая конфигурация приложения из окружения.

Все настройки, зависящие от среды выполнения, читаются здесь.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.core.paths import BACKEND_ROOT


def resolve_sqlite_url(db_url: str) -> str:
    """Относительный sqlite:///file.db → абсолютный путь в backend/.

    Иначе uvicorn и CLI, запущенные из разных cwd, читают разные файлы.
    После пересоздания dashboard.db работающий uvicorn может держать старый inode.
    """
    if not db_url.startswith('sqlite:///'):
        return db_url
    if db_url in ('sqlite:///:memory:', 'sqlite://'):
        return db_url
    path_part = db_url.removeprefix('sqlite:///')
    if not path_part or path_part.startswith('/'):
        return db_url
    return f'sqlite:///{(BACKEND_ROOT / path_part).resolve()}'


class Settings(BaseSettings):
    """Конфигурация web-процесса и CLI-утилит."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_url: str = Field(default="sqlite:///dashboard.db", validation_alias="DB_URL")

    @field_validator('db_url', mode='after')
    @classmethod
    def normalize_db_url(cls, value: str) -> str:
        return resolve_sqlite_url(value)

    # --- HTTP / безопасность ---
    cors_origins: str = Field(
        default="http://localhost:4200",
        validation_alias="CORS_ORIGINS",
    )
    rate_limit: str = Field(default="60/minute", validation_alias="RATE_LIMIT")
    rate_limit_enabled: bool = Field(default=True, validation_alias="RATE_LIMIT_ENABLED")

    # --- JWT / авторизация ---
    jwt_secret_key: str = Field(
        default="dev-only-change-me-use-openssl-rand-hex-32",
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

    # --- iiko REST API (CLI / admin processes, 12-factor XII) ---
    iiko_url: str | None = Field(default=None, validation_alias="IIKO_URL")
    iiko_login: str | None = Field(default=None, validation_alias="IIKO_LOGIN")
    iiko_password: str | None = Field(default=None, validation_alias="IIKO_PASSWORD")

    def require_iiko(self) -> tuple[str, str, str]:
        """Credentials для CLI; явная ошибка, если не заданы в окружении."""
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
        return self.iiko_url, self.iiko_login, self.iiko_password  # type: ignore[return-value]

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
