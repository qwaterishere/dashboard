"""Загрузка продаж iiko в БД — общая логика для CLI и web (12-factor XII)."""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.restaurant import Restaurant
from src.db.models.sales import Order
from src.db.session import db_manager
from src.integrations.iiko.client import IikoClient
from src.services.sales import parse_records, replace_day

logger = logging.getLogger(__name__)

STALE_SYNC_MINUTES = 30


def history_limit(today: date | None = None) -> date:
    today = today or date.today()
    return date(today.year - 1, 1, 1)


def date_chunks(date_from: date, date_to: date, *, chunk_days: int = 1):
    if chunk_days < 1:
        raise ValueError("chunk_days must be >= 1")
    cur = date_from
    while cur <= date_to:
        end = min(cur + timedelta(days=chunk_days - 1), date_to)
        yield cur, end
        cur = end + timedelta(days=1)


def month_chunks(date_from: date, date_to: date):
    cur = date_from
    while cur <= date_to:
        month_end = (cur.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        yield cur, min(month_end, date_to)
        cur = month_end + timedelta(days=1)


@dataclass(frozen=True)
class SyncPlan:
    date_from: date
    date_to: date


@dataclass(frozen=True)
class SyncStats:
    date_from: date
    date_to: date
    days_loaded: int
    rows_loaded: int


def resolve_sync_plan(
    session: Session,
    restaurant_id: uuid.UUID,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> SyncPlan | None:
    """Диапазон загрузки: как в CLI — от последнего дня в БД до вчера."""
    yesterday = date.today() - timedelta(days=1)
    resolved_to = min(date_to or yesterday, yesterday)

    last = session.query(func.max(Order.day)).filter(
        Order.restaurant_id == restaurant_id,
    ).scalar()

    resolved_from = date_from
    if last is None:
        limit = history_limit()
        if resolved_from is None:
            resolved_from = limit
        elif resolved_from < limit:
            resolved_from = limit
    elif resolved_from is None:
        resolved_from = last

    if resolved_from > resolved_to:
        return None
    return SyncPlan(date_from=resolved_from, date_to=resolved_to)


def sync_plan_day_count(date_from: date, date_to: date) -> int:
    return (date_to - date_from).days + 1


def sync_progress_percent(restaurant: Restaurant) -> int | None:
    if restaurant.sync_status != "running":
        return None
    if restaurant.sync_plan_from is None or restaurant.sync_plan_to is None:
        return 0
    total = sync_plan_day_count(restaurant.sync_plan_from, restaurant.sync_plan_to)
    if total <= 0:
        return 0
    done = restaurant.sync_days_done or 0
    return min(100, round(done / total * 100))


def _clear_sync_progress(restaurant: Restaurant) -> None:
    restaurant.sync_plan_from = None
    restaurant.sync_plan_to = None
    restaurant.sync_days_done = None
    restaurant.sync_current_day = None


def _update_sync_progress(
    restaurant_id: uuid.UUID,
    *,
    plan_from: date | None = None,
    plan_to: date | None = None,
    current_day: date | None = None,
    days_done: int | None = None,
) -> None:
    session = db_manager.get_session()
    try:
        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is None or restaurant.sync_status != "running":
            return
        if plan_from is not None:
            restaurant.sync_plan_from = plan_from
        if plan_to is not None:
            restaurant.sync_plan_to = plan_to
        if current_day is not None:
            restaurant.sync_current_day = current_day
        if days_done is not None:
            restaurant.sync_days_done = days_done
        session.commit()
    finally:
        session.close()


def sync_restaurant_sales(
    restaurant: Restaurant,
    date_from: date,
    date_to: date,
    *,
    chunk_days: int = 1,
) -> SyncStats:
    if not restaurant.iiko_configured:
        raise RuntimeError("iiko is not configured")

    days_loaded = 0
    rows_loaded = 0

    _update_sync_progress(
        restaurant.id,
        plan_from=date_from,
        plan_to=date_to,
        current_day=date_from,
        days_done=0,
    )

    with IikoClient(*restaurant.iiko_credentials()) as client:
        for chunk_from, chunk_to in date_chunks(date_from, date_to, chunk_days=chunk_days):
            raw = client.fetch_sales(chunk_from, chunk_to)
            records = parse_records(raw)
            rows_loaded += len(raw)

            by_day: dict[date, list] = defaultdict(list)
            for rec in records:
                by_day[rec.day].append(rec)

            for day in sorted(by_day):
                _update_sync_progress(
                    restaurant.id,
                    current_day=day,
                    days_done=days_loaded,
                )
                session = db_manager.get_session()
                try:
                    replace_day(
                        session,
                        day,
                        by_day[day],
                        restaurant_id=restaurant.id,
                    )
                    session.commit()
                    days_loaded += 1
                except Exception:
                    session.rollback()
                    raise
                finally:
                    session.close()

    return SyncStats(
        date_from=date_from,
        date_to=date_to,
        days_loaded=days_loaded,
        rows_loaded=rows_loaded,
    )


def _utc_now() -> datetime:
    return datetime.now(UTC)


def normalize_sync_status(restaurant: Restaurant) -> tuple[str, str | None]:
    """Сбрасывает зависший running после рестарта процесса."""
    if restaurant.sync_status != "running" or restaurant.sync_started_at is None:
        return restaurant.sync_status, restaurant.last_sync_error

    started = restaurant.sync_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if _utc_now() - started.astimezone(UTC) > timedelta(minutes=STALE_SYNC_MINUTES):
        return "error", "Sync was interrupted — try again"
    return restaurant.sync_status, restaurant.last_sync_error


def run_sync_job(restaurant_id: uuid.UUID) -> None:
    """Фоновая задача: один web/CLI sync для ресторана."""
    session = db_manager.get_session()
    try:
        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is None:
            logger.error("sync job: restaurant %s not found", restaurant_id)
            return

        plan = resolve_sync_plan(session, restaurant_id)
        if plan is None:
            restaurant.sync_status = "noop"
            restaurant.last_sync_at = _utc_now()
            restaurant.last_sync_error = None
            restaurant.last_sync_from = None
            restaurant.last_sync_to = None
            restaurant.last_sync_days = 0
            _clear_sync_progress(restaurant)
            session.commit()
            return

        restaurant.sync_plan_from = plan.date_from
        restaurant.sync_plan_to = plan.date_to
        restaurant.sync_days_done = 0
        restaurant.sync_current_day = plan.date_from
        session.commit()

        stats = sync_restaurant_sales(restaurant, plan.date_from, plan.date_to)

        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is None:
            return
        restaurant.sync_status = "success"
        restaurant.last_sync_at = _utc_now()
        restaurant.last_sync_error = None
        restaurant.last_sync_from = stats.date_from
        restaurant.last_sync_to = stats.date_to
        restaurant.last_sync_days = stats.days_loaded
        _clear_sync_progress(restaurant)
        session.commit()
        logger.info(
            "iiko sync done restaurant=%s days=%s rows=%s",
            restaurant_id,
            stats.days_loaded,
            stats.rows_loaded,
        )
    except Exception:
        logger.exception("iiko sync failed restaurant=%s", restaurant_id)
        session.rollback()
        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is not None:
            restaurant.sync_status = "error"
            restaurant.last_sync_at = _utc_now()
            restaurant.last_sync_error = "Failed to load data from iiko"
            _clear_sync_progress(restaurant)
            session.commit()
    finally:
        session.close()
