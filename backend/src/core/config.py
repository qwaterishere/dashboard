"""Единая конфигурация приложения из окружения.

Все настройки, зависящие от среды выполнения, читаются здесь.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.core.paths import BACKEND_ROOT


class Settings(BaseSettings):
    """Конфигурация web-процесса и CLI-утилит."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db_url: str = Field(default="sqlite:///dashboard.db", validation_alias="DB_URL")

    # --- HTTP / безопасность ---
    cors_origins: str = Field(
        default="http://localhost:4200",
        validation_alias="CORS_ORIGINS",
    )
    rate_limit: str = Field(default="60/minute", validation_alias="RATE_LIMIT")
    rate_limit_enabled: bool = Field(default=True, validation_alias="RATE_LIMIT_ENABLED")

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
