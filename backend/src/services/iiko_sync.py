"""Загрузка продаж iiko в БД — общая логика для CLI и web (12-factor XII)."""

from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
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
    full: bool = False,
) -> SyncPlan | None:
    """Диапазон загрузки: incremental — от последнего дня в БД; full — с history_limit()."""
    yesterday = date.today() - timedelta(days=1)
    resolved_to = min(date_to or yesterday, yesterday)

    last = session.query(func.max(Order.day)).filter(
        Order.restaurant_id == restaurant_id,
    ).scalar()

    limit = history_limit()
    resolved_from = date_from
    if full:
        resolved_from = date_from if date_from is not None else limit
        if resolved_from < limit:
            resolved_from = limit
    elif last is None:
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


QUEUED_STATUSES = frozenset({"queued", "queued_full"})


def normalize_sync_status(restaurant: Restaurant) -> tuple[str, str | None]:
    """Публичный статус: queued* → pending; stale running → error."""
    raw = restaurant.sync_status
    if raw in QUEUED_STATUSES:
        return "pending", restaurant.last_sync_error

    if raw != "running" or restaurant.sync_started_at is None:
        return raw, restaurant.last_sync_error

    started = restaurant.sync_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if _utc_now() - started.astimezone(UTC) > timedelta(minutes=STALE_SYNC_MINUTES):
        return "error", "Sync was interrupted — try again"
    return raw, restaurant.last_sync_error


def _is_stale_running(restaurant: Restaurant) -> bool:
    if restaurant.sync_status != "running" or restaurant.sync_started_at is None:
        return False
    started = restaurant.sync_started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    return _utc_now() - started.astimezone(UTC) > timedelta(minutes=STALE_SYNC_MINUTES)


def enqueue_sync(
    session: Session,
    restaurant_id: uuid.UUID,
    *,
    full: bool = False,
) -> bool:
    """FOR UPDATE; queue sync. False if busy (running non-stale or already queued*).

    Stale running → mark error, then queue. Sets ``queued_full``|``queued``.
    """
    restaurant = session.scalar(
        select(Restaurant).where(Restaurant.id == restaurant_id).with_for_update()
    )
    if restaurant is None or not restaurant.iiko_configured:
        return False

    if restaurant.sync_status in QUEUED_STATUSES:
        return False

    if restaurant.sync_status == "running":
        if not _is_stale_running(restaurant):
            return False
        restaurant.sync_status = "error"
        restaurant.last_sync_error = "Sync was interrupted — try again"
        _clear_sync_progress(restaurant)
        session.flush()

    restaurant.sync_status = "queued_full" if full else "queued"
    restaurant.last_sync_error = None
    session.commit()
    return True


def claim_queued_sync(session: Session, restaurant_id: uuid.UUID) -> tuple[bool, bool]:
    """FOR UPDATE; if queued|queued_full → set running.

    Returns ``(claimed, full)``.
    """
    restaurant = session.scalar(
        select(Restaurant).where(Restaurant.id == restaurant_id).with_for_update()
    )
    if restaurant is None:
        return False, False

    if restaurant.sync_status == "queued_full":
        full = True
    elif restaurant.sync_status == "queued":
        full = False
    else:
        return False, False

    restaurant.sync_status = "running"
    restaurant.sync_started_at = _utc_now()
    restaurant.last_sync_error = None
    session.commit()
    return True, full


def acquire_sync_lock(session: Session, restaurant_id: uuid.UUID) -> bool:
    """Атомарно ставит sync_status=running; False если занят или не настроен.

    SELECT … FOR UPDATE: при stale running сначала фиксирует error в БД,
    затем перехватывает лок (running). Отказывает при queued* (другой путь).
    """
    restaurant = session.scalar(
        select(Restaurant).where(Restaurant.id == restaurant_id).with_for_update()
    )
    if restaurant is None or not restaurant.iiko_configured:
        return False

    if restaurant.sync_status in QUEUED_STATUSES:
        return False

    if restaurant.sync_status == "running":
        if not _is_stale_running(restaurant):
            return False
        restaurant.sync_status = "error"
        restaurant.last_sync_error = "Sync was interrupted — try again"
        _clear_sync_progress(restaurant)
        session.flush()

    restaurant.sync_status = "running"
    restaurant.sync_started_at = _utc_now()
    restaurant.last_sync_error = None
    session.commit()
    return True


def run_sync_job(restaurant_id: uuid.UUID, *, full: bool = False) -> None:
    """Фоновая задача: продажи + склад для ресторана (UI / шедулер).

    Порядок: sales → stock. Ошибка склада после успешных продаж
    помечает весь job как error (решение product: 2A).
    """
    from src.services.warehouse_sync import resolve_stock_plan, sync_restaurant_stock

    session = db_manager.get_session()
    try:
        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is None:
            logger.error("sync job: restaurant %s not found", restaurant_id)
            return

        sales_plan = resolve_sync_plan(session, restaurant_id, full=full)
        stock_plan = resolve_stock_plan(restaurant_id)

        if sales_plan is None and stock_plan is None:
            restaurant.sync_status = "noop"
            restaurant.last_sync_at = _utc_now()
            restaurant.last_sync_error = None
            restaurant.last_sync_from = None
            restaurant.last_sync_to = None
            restaurant.last_sync_days = 0
            _clear_sync_progress(restaurant)
            session.commit()
            return

        sales_stats: SyncStats | None = None
        if sales_plan is not None:
            restaurant.sync_plan_from = sales_plan.date_from
            restaurant.sync_plan_to = sales_plan.date_to
            restaurant.sync_days_done = 0
            restaurant.sync_current_day = sales_plan.date_from
            session.commit()

            sales_stats = sync_restaurant_sales(
                restaurant, sales_plan.date_from, sales_plan.date_to,
            )

        def _stock_progress(
            days_done: int,
            current_day: date,
            plan_from: date,
            plan_to: date,
        ) -> None:
            _update_sync_progress(
                restaurant_id,
                plan_from=plan_from,
                plan_to=plan_to,
                current_day=current_day,
                days_done=days_done,
            )

        # Detached restaurant may be stale after sales; reload credentials row.
        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is None:
            return

        stock_stats = sync_restaurant_stock(
            restaurant,
            progress_hook=_stock_progress if stock_plan is not None else None,
        )

        restaurant = session.get(Restaurant, restaurant_id)
        if restaurant is None:
            return

        restaurant.sync_status = "success"
        restaurant.last_sync_at = _utc_now()
        restaurant.last_sync_error = None
        if sales_stats is not None:
            restaurant.last_sync_from = sales_stats.date_from
            restaurant.last_sync_to = sales_stats.date_to
            restaurant.last_sync_days = sales_stats.days_loaded
        elif stock_stats.date_from is not None:
            restaurant.last_sync_from = stock_stats.date_from
            restaurant.last_sync_to = stock_stats.date_to
            restaurant.last_sync_days = stock_stats.days_loaded
        else:
            restaurant.last_sync_from = None
            restaurant.last_sync_to = None
            restaurant.last_sync_days = 0
        _clear_sync_progress(restaurant)
        session.commit()
        logger.info(
            "iiko sync done restaurant=%s sales_days=%s stock_days=%s",
            restaurant_id,
            sales_stats.days_loaded if sales_stats else 0,
            stock_stats.days_loaded,
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


def process_queued_sync(restaurant_id: uuid.UUID) -> None:
    """Claim a queued sync and run ``run_sync_job``."""
    session = db_manager.get_session()
    try:
        claimed, full = claim_queued_sync(session, restaurant_id)
    finally:
        session.close()
    if not claimed:
        return
    run_sync_job(restaurant_id, full=full)
