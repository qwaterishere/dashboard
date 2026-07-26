"""Контракты настроек iiko пользователя."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from src.core.iiko_url import validate_iiko_url
from src.schemas.base import StrictModel

SyncStatus = Literal["idle", "pending", "running", "success", "error", "noop"]
SyncPhase = Literal["sales", "stock"]
StockDomainStatus = Literal["idle", "running", "success", "error", "skipped"]


class StockSyncPublic(StrictModel):
    status: StockDomainStatus
    latest_day: date | None = None
    lag_days: int | None = None
    days_done: int | None = None
    error: str | None = None


class IikoSyncPublic(StrictModel):
    status: SyncStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    date_from: date | None = None
    date_to: date | None = None
    days_loaded: int | None = None
    plan_from: date | None = None
    plan_to: date | None = None
    days_done: int | None = None
    current_day: date | None = None
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    phase: SyncPhase | None = Field(
        default=None,
        description="sales | stock во время running; иначе null",
    )
    error: str | None = None
    stock: StockSyncPublic


class IikoSettingsPublic(StrictModel):
    restaurant_id: UUID
    configured: bool
    iiko_url: str | None = None
    iiko_login: str | None = None
    updated_at: datetime | None = None
    sync: IikoSyncPublic


class IikoSyncStartResponse(StrictModel):
    status: Literal["pending"] = "pending"
    started_at: datetime


class UpdateIikoSettingsRequest(StrictModel):
    iiko_url: str = Field(min_length=1, max_length=500)
    iiko_login: str = Field(min_length=1, max_length=200)
    iiko_password: str = Field(default="", max_length=200)

    @field_validator("iiko_url", "iiko_login", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("iiko_url", mode="after")
    @classmethod
    def validate_url(cls, value: str) -> str:
        return validate_iiko_url(value, resolve_dns=False)
