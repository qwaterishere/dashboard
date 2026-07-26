"""Планировщик автоматической incremental-синхронизации iiko."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.db.models.restaurant import Restaurant
from src.db.session import db_manager
from src.services.data_freshness import resolve_restaurant_timezone
from src.services.iiko_sync import (
    QUEUED_STATUSES,
    enqueue_sync,
    normalize_sync_status,
    process_queued_sync,
    resolve_sync_plan,
)
from src.services.warehouse_sync import resolve_stock_plan

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ScheduledSyncOutcome:
    restaurant_id: uuid.UUID
    result: str
    detail: str | None = None


def list_iiko_restaurants(session: Session) -> list[Restaurant]:
    return list(
        session.scalars(
            select(Restaurant).where(
                Restaurant.iiko_url.isnot(None),
                Restaurant.iiko_login.isnot(None),
                Restaurant.iiko_password_encrypted.isnot(None),
            )
        )
    )


def list_queued_restaurants(session: Session) -> list[Restaurant]:
    return list(
        session.scalars(
            select(Restaurant).where(Restaurant.sync_status.in_(tuple(QUEUED_STATUSES)))
        )
    )


def should_auto_sync(
    session: Session,
    restaurant: Restaurant,
    *,
    now: datetime | None = None,
) -> tuple[bool, str]:
    """Нужна ли автосинхронизация для ресторана."""
    if not restaurant.iiko_configured:
        return False, "not_configured"
    if not restaurant.auto_sync_enabled:
        return False, "auto_sync_disabled"

    moment = now or datetime.now(UTC)
    status, _ = normalize_sync_status(restaurant)
    if status in ("running", "pending"):
        return False, "already_running" if status == "running" else "already_queued"

    plan = resolve_sync_plan(session, restaurant.id, full=False)
    if plan is not None:
        return True, "pending_data"

    stock_plan = resolve_stock_plan(restaurant.id)
    if stock_plan is not None:
        return True, "pending_stock"

    if status == "error" and _in_retry_window(restaurant, moment):
        return True, "retry_after_error"

    return False, "up_to_date"


def _in_retry_window(restaurant: Restaurant, moment: datetime) -> bool:
    settings = get_settings()
    tz = resolve_restaurant_timezone(restaurant.timezone)
    local_hour = moment.astimezone(tz).hour
    if settings.sync_morning_hour_start <= local_hour <= settings.sync_morning_hour_end:
        return True
    return local_hour == settings.sync_midday_hour


def run_auto_sync_for_restaurant(
    session: Session,
    restaurant: Restaurant,
    *,
    now: datetime | None = None,
) -> ScheduledSyncOutcome:
    should, reason = should_auto_sync(session, restaurant, now=now)
    if not should:
        return ScheduledSyncOutcome(restaurant.id, "skipped", reason)

    if not enqueue_sync(session, restaurant.id, full=False):
        return ScheduledSyncOutcome(restaurant.id, "skipped", "enqueue_failed")

    logger.info("auto iiko sync queued restaurant=%s reason=%s", restaurant.id, reason)
    process_queued_sync(restaurant.id)
    return ScheduledSyncOutcome(restaurant.id, "completed", reason)


def enqueue_due_syncs(
    *,
    restaurant_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> list[ScheduledSyncOutcome]:
    """Только ставит due-рестораны в очередь (queued/skipped).

    Работа выполняет ``python -m src.cli.sync_worker`` / ``run_scheduled_syncs``.
    """
    session = db_manager.get_session()
    outcomes: list[ScheduledSyncOutcome] = []
    try:
        restaurants: list[Restaurant]
        if restaurant_id is not None:
            restaurant = session.get(Restaurant, restaurant_id)
            if restaurant is None:
                return [ScheduledSyncOutcome(restaurant_id, "skipped", "not_found")]
            restaurants = [restaurant]
        else:
            restaurants = list_iiko_restaurants(session)

        for restaurant in restaurants:
            session.expire(restaurant)
            restaurant = session.get(Restaurant, restaurant.id)
            if restaurant is None:
                continue
            should, reason = should_auto_sync(session, restaurant, now=now)
            if not should:
                outcomes.append(ScheduledSyncOutcome(restaurant.id, "skipped", reason))
                continue
            if enqueue_sync(session, restaurant.id, full=False):
                outcomes.append(ScheduledSyncOutcome(restaurant.id, "queued", reason))
            else:
                outcomes.append(ScheduledSyncOutcome(restaurant.id, "skipped", "enqueue_failed"))
        return outcomes
    finally:
        session.close()


def run_scheduled_syncs(
    *,
    restaurant_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> list[ScheduledSyncOutcome]:
    """Один проход worker: drain queue, затем enqueue+process due-ресторанов."""
    session = db_manager.get_session()
    outcomes: list[ScheduledSyncOutcome] = []
    try:
        if restaurant_id is not None:
            restaurant = session.get(Restaurant, restaurant_id)
            if restaurant is None:
                return [ScheduledSyncOutcome(restaurant_id, "skipped", "not_found")]
            if restaurant.sync_status in QUEUED_STATUSES:
                process_queued_sync(restaurant.id)
                outcomes.append(
                    ScheduledSyncOutcome(restaurant.id, "completed", "drained_queue"),
                )
                return outcomes
            outcomes.append(run_auto_sync_for_restaurant(session, restaurant, now=now))
            return outcomes

        for restaurant in list_queued_restaurants(session):
            rid = restaurant.id
            process_queued_sync(rid)
            outcomes.append(ScheduledSyncOutcome(rid, "completed", "drained_queue"))

        for restaurant in list_iiko_restaurants(session):
            session.expire(restaurant)
            restaurant = session.get(Restaurant, restaurant.id)
            if restaurant is None:
                continue
            if restaurant.sync_status in QUEUED_STATUSES:
                # Already drained above; skip to avoid double-process race.
                continue
            outcomes.append(run_auto_sync_for_restaurant(session, restaurant, now=now))
        return outcomes
    finally:
        session.close()
