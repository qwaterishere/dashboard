"""Статус актуальности продаж в БД относительно закрытого дня в TZ ресторана."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.db.models.restaurant import Restaurant
from src.schemas.dashboard import DataFreshness
from src.services.dashboard import _data_bounds
from src.services.iiko_sync import normalize_sync_status, sync_progress_percent


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


def build_data_freshness(
    session: Session,
    restaurant: Restaurant,
    *,
    now: datetime | None = None,
) -> DataFreshness:
    moment = now or datetime.now(UTC)
    tz = resolve_restaurant_timezone(restaurant.timezone)
    expected = expected_closed_sales_day(tz, now=moment)
    earliest, latest = _data_bounds(session, restaurant.id)
    sync_status, sync_error = normalize_sync_status(restaurant)

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
    )

    progress = sync_progress_percent(restaurant) if sync_status == "running" else None

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
    )


def _resolve_status(
    *,
    latest: date | None,
    expected: date,
    sync_status: str,
    iiko_configured: bool,
    auto_sync_enabled: bool,
) -> str:
    if not iiko_configured:
        return "unconfigured"
    if latest is None:
        return "empty"
    if sync_status == "running":
        return "syncing"
    if latest >= expected:
        return "fresh"
    if sync_status == "error":
        return "error"
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
