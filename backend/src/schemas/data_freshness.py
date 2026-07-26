"""Актуальность продаж и склада относительно закрытого дня."""

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from .base import StrictModel

DataFreshnessStatus = Literal[
    "fresh",
    "stale",
    "stale_manual",
    "syncing",
    "error",
    "empty",
    "unconfigured",
]

SyncStatus = Literal["idle", "pending", "running", "success", "error", "noop"]
SyncPhase = Literal["sales", "stock"]
StockDomainStatus = Literal["idle", "running", "success", "error", "skipped"]


class StockFreshness(StrictModel):
    """Актуальность слепков склада (домен stock)."""

    latestDay: date | None = Field(
        description="Последний день со слепком остатков; null — слепков нет",
    )
    lagDays: int | None = Field(
        description="Отставание склада в календарных днях; null — нет данных",
    )
    syncStatus: StockDomainStatus = Field(description="Статус домена stock")
    syncError: str | None = Field(description="Ошибка синка склада; null — нет")
    daysDone: int | None = Field(
        default=None,
        description="Дней склада, уже загруженных в текущем job; null — не stock-фаза",
    )


class DataFreshness(StrictModel):
    """Актуальность продаж (+ склад) в БД относительно закрытого дня (TZ ресторана)."""

    status: DataFreshnessStatus
    expectedDay: date = Field(description="Ожидаемый последний закрытый день (вчера в TZ)")
    latestSalesDay: date | None = Field(
        description="Фактический последний день с продажами в БД",
    )
    lagDays: int | None = Field(
        description="Отставание продаж в календарных днях; null — нет данных",
    )
    lastSyncAt: datetime | None = Field(description="Завершение последней синхронизации iiko")
    syncStatus: SyncStatus = Field(description="Текущий статус sync job")
    syncError: str | None = Field(description="Сообщение об ошибке sync; null — нет ошибки")
    autoSyncEnabled: bool = Field(
        description="Автосинхронизация включена и iiko настроен",
    )
    syncProgressPercent: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Прогресс текущей синхронизации; null — sync не идёт",
    )
    syncPhase: SyncPhase | None = Field(
        default=None,
        description="Фаза текущего job: продажи или склад; null — sync не идёт",
    )
    stock: StockFreshness = Field(description="Актуальность домена склада")
