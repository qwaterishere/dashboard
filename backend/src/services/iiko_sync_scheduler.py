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
    acquire_sync_lock,
    normalize_sync_status,
    resolve_sync_plan,
    run_sync_job,
)

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
    if status == "running":
        return False, "already_running"

    plan = resolve_sync_plan(session, restaurant.id, full=False)
    if plan is not None:
        return True, "pending_data"

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

    if not acquire_sync_lock(session, restaurant.id):
        return ScheduledSyncOutcome(restaurant.id, "skipped", "lock_failed")

    logger.info("auto iiko sync starting restaurant=%s reason=%s", restaurant.id, reason)
    run_sync_job(restaurant.id, full=False)
    return ScheduledSyncOutcome(restaurant.id, "completed", reason)


def run_scheduled_syncs(
    *,
    restaurant_id: uuid.UUID | None = None,
    now: datetime | None = None,
) -> list[ScheduledSyncOutcome]:
    """Один проход worker/cron: incremental sync для всех due-ресторанов."""
    session = db_manager.get_session()
    outcomes: list[ScheduledSyncOutcome] = []
    try:
        if restaurant_id is not None:
            restaurant = session.get(Restaurant, restaurant_id)
            if restaurant is None:
                return [ScheduledSyncOutcome(restaurant_id, "skipped", "not_found")]
            outcomes.append(run_auto_sync_for_restaurant(session, restaurant, now=now))
            return outcomes

        for restaurant in list_iiko_restaurants(session):
            session.expire(restaurant)
            restaurant = session.get(Restaurant, restaurant.id)
            if restaurant is None:
                continue
            outcomes.append(run_auto_sync_for_restaurant(session, restaurant, now=now))
        return outcomes
    finally:
        session.close()
