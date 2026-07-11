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

    payload = f"{restaurant_id}:{year}:{month}:{latest_token}:{sync_token}"
    digest = hashlib.sha256(payload.encode()).hexdigest()[:16]
    return f'W/"{digest}"'
