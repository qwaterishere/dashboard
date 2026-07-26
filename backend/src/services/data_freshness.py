"""Статус актуальности продаж и склада в БД относительно закрытого дня."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.db.models.restaurant import Restaurant
from src.schemas.data_freshness import DataFreshness, StockFreshness
from src.services.analytics.queries import data_bounds
from src.services.iiko_sync import normalize_sync_status, sync_progress_percent
from src.services.warehouse_sync import get_stock_domain_status, latest_stock_day


def resolve_restaurant_timezone(tz_name: str | None) -> ZoneInfo:
    settings = get_settings()
    candidate = (tz_name or settings.sync_default_timezone).strip()
    try:
        return ZoneInfo(candidate)
    except ZoneInfoNotFoundError:
        return ZoneInfo(settings.sync_default_timezone)


def expected_closed_sales_day(
    tz: ZoneInfo,
    *,
    now: datetime | None = None,
) -> date:
    """Последний полностью закрытый календарный день (вчера в TZ ресторана)."""
    moment = now or datetime.now(UTC)
    local_today = moment.astimezone(tz).date()
    return local_today - timedelta(days=1)


def resolve_sync_phase(
    session: Session,
    restaurant: Restaurant,
) -> Literal["sales", "stock"] | None:
    if restaurant.sync_status != "running":
        return None
    stock = get_stock_domain_status(session, restaurant.id)
    if stock is not None and stock.status == "running":
        return "stock"
    return "sales"


def build_stock_freshness(
    session: Session,
    restaurant: Restaurant,
    *,
    expected: date,
) -> StockFreshness:
    stock_row = get_stock_domain_status(session, restaurant.id)
    latest = latest_stock_day(session, restaurant.id)
    if latest is None and stock_row is not None and stock_row.last_day is not None:
        latest = stock_row.last_day

    lag_days: int | None
    if latest is None:
        lag_days = None
    else:
        lag_days = max(0, (expected - latest).days)

    status = "idle"
    error = None
    days_done = None
    if stock_row is not None:
        status = stock_row.status  # type: ignore[assignment]
        error = stock_row.error
        if stock_row.status == "running":
            days_done = stock_row.days_done

    return StockFreshness(
        latestDay=latest,
        lagDays=lag_days,
        syncStatus=status,  # type: ignore[arg-type]
        syncError=error,
        daysDone=days_done,
    )


def build_data_freshness(
    session: Session,
    restaurant: Restaurant,
    *,
    now: datetime | None = None,
) -> DataFreshness:
    moment = now or datetime.now(UTC)
    tz = resolve_restaurant_timezone(restaurant.timezone)
    expected = expected_closed_sales_day(tz, now=moment)
    earliest, latest = data_bounds(session, restaurant.id)
    sync_status, sync_error = normalize_sync_status(restaurant)
    stock = build_stock_freshness(session, restaurant, expected=expected)

    lag_days: int | None
    if latest is None:
        lag_days = None
    else:
        lag_days = max(0, (expected - latest).days)

    status = _resolve_status(
        latest=latest,
        expected=expected,
        sync_status=sync_status,
        iiko_configured=restaurant.iiko_configured,
        auto_sync_enabled=restaurant.auto_sync_enabled,
        stock=stock,
    )

    progress = sync_progress_percent(restaurant) if sync_status == "running" else None
    phase = resolve_sync_phase(session, restaurant) if sync_status == "running" else None

    return DataFreshness(
        status=status,
        expectedDay=expected,
        latestSalesDay=latest,
        lagDays=lag_days,
        lastSyncAt=restaurant.last_sync_at,
        syncStatus=sync_status,  # type: ignore[arg-type]
        syncError=sync_error,
        autoSyncEnabled=restaurant.auto_sync_enabled and restaurant.iiko_configured,
        syncProgressPercent=progress,
        syncPhase=phase,
        stock=stock,
    )


def _resolve_status(
    *,
    latest: date | None,
    expected: date,
    sync_status: str,
    iiko_configured: bool,
    auto_sync_enabled: bool,
    stock: StockFreshness,
) -> str:
    if not iiko_configured:
        return "unconfigured"
    if latest is None:
        return "empty"
    if sync_status in ("running", "pending"):
        return "syncing"
    if sync_status == "error" or stock.syncStatus == "error":
        return "error"
    if latest >= expected:
        # Продажи свежие, но склад отстаёт — stale, чтобы badge/worker видели дыру.
        if stock.latestDay is None or (stock.lagDays is not None and stock.lagDays > 0):
            if not auto_sync_enabled:
                return "stale_manual"
            return "stale"
        return "fresh"
    if not auto_sync_enabled:
        return "stale_manual"
    return "stale"


def build_data_freshness_for_restaurant(
    session: Session,
    restaurant_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> DataFreshness | None:
    restaurant = session.get(Restaurant, restaurant_id)
    if restaurant is None:
        return None
    return build_data_freshness(session, restaurant, now=now)
