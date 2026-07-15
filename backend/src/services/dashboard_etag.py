"""Weak ETag для GET /api/dashboard — tenant + период + версия данных."""

from __future__ import annotations

import calendar
import hashlib
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.restaurant import Restaurant
from src.db.models.sales import Order

# Bump when response semantics change without data/sync change
# (e.g. forecast horizon fix) — invalidates client If-None-Match.
ETAG_SCHEMA_VERSION = "v5"


def _sync_version(restaurant: Restaurant | None) -> int:
    if restaurant is None:
        return 0
    if restaurant.last_sync_at is not None:
        return int(restaurant.last_sync_at.timestamp())
    return int(restaurant.updated_at.timestamp())


def compute_dashboard_etag(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None,
    month: int | None,
    week_start: date | None = None,
    week_end: date | None = None,
    compare_start: date | None = None,
    compare_end: date | None = None,
    scope: str = "full",
) -> str:
    """ETag из restaurant_id, query-периода, max(day) и метки sync."""
    restaurant = session.get(Restaurant, restaurant_id)
    sync_token = _sync_version(restaurant)

    latest_query = session.query(func.max(Order.day)).filter(
        Order.restaurant_id == restaurant_id,
    )

    if year is not None and month is not None:
        month_end = date(year, month, calendar.monthrange(year, month)[1])
        latest_query = latest_query.filter(
            Order.day >= date(year, month, 1),
            Order.day <= month_end,
        )
    elif year is not None:
        latest_query = latest_query.filter(
            Order.day >= date(year, 1, 1),
            Order.day <= date(year, 12, 31),
        )

    latest = latest_query.scalar()
    latest_token = latest.isoformat() if latest else ""

    week_token = ""
    if week_start is not None and week_end is not None:
        week_token = f"{week_start.isoformat()}:{week_end.isoformat()}"

    compare_token = ""
    if compare_start is not None and compare_end is not None:
        compare_token = f"{compare_start.isoformat()}:{compare_end.isoformat()}"

    payload = (
        f"{ETAG_SCHEMA_VERSION}:{scope}:{restaurant_id}:{year}:{month}:{week_token}:"
        f"{compare_token}:{latest_token}:{sync_token}"
    )
    digest = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f'W/"{digest}"'
