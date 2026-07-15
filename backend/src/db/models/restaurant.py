"""Ресторан пользователя: привязка iiko и изоляция данных продаж."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.core.credentials import decrypt_secret, encrypt_secret
from src.core.iiko_url import validate_iiko_url
from src.db.session import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    iiko_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    iiko_login: Mapped[str | None] = mapped_column(String(200), nullable=True)
    iiko_password_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    iiko_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    sync_status: Mapped[str] = mapped_column(String(16), default="idle", nullable=False)
    sync_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    last_sync_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_sync_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_sync_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_sync_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sync_plan_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    sync_plan_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    sync_days_done: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sync_current_day: Mapped[date | None] = mapped_column(Date, nullable=True)
    timezone: Mapped[str] = mapped_column(
        String(64),
        default="Asia/Bishkek",
        nullable=False,
    )
    auto_sync_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="restaurant")  # noqa: F821

    @property
    def iiko_configured(self) -> bool:
        return bool(self.iiko_url and self.iiko_login and self.iiko_password_encrypted)

    def set_iiko_credentials(self, url: str, login: str, password: str) -> None:
        self.iiko_url = validate_iiko_url(url, resolve_dns=False)
        self.iiko_login = login.strip()
        self.iiko_password_encrypted = encrypt_secret(password)
        self.iiko_updated_at = datetime.now(UTC)

    def iiko_credentials(self) -> tuple[str, str, str]:
        if not self.iiko_configured:
            raise RuntimeError("iiko credentials are not configured")
        assert self.iiko_url is not None
        assert self.iiko_login is not None
        assert self.iiko_password_encrypted is not None
        return (
            self.iiko_url,
            self.iiko_login,
            decrypt_secret(self.iiko_password_encrypted),
        )
