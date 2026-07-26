"""Ресторан пользователя и настройки iiko."""

from __future__ import annotations

import uuid

from datetime import UTC, datetime

from starlette import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models.restaurant import Restaurant
from src.db.models.user import User
from src.integrations.iiko.client import IikoClient
from src.integrations.iiko.exceptions import IikoAuthError, IikoError
from src.schemas.restaurant import (
    IikoSettingsPublic,
    IikoSyncPublic,
    IikoSyncStartResponse,
    StockSyncPublic,
    UpdateIikoSettingsRequest,
)
from src.services.data_freshness import (
    expected_closed_sales_day,
    resolve_restaurant_timezone,
    resolve_sync_phase,
)
from src.services.errors import RestaurantError
from src.services.iiko_sync import (
    enqueue_sync,
    normalize_sync_status,
    process_queued_sync,
    sync_progress_percent,
)
from src.services.warehouse_sync import get_stock_domain_status, latest_stock_day


def get_or_create_restaurant(db: Session, user: User) -> Restaurant:
    restaurant = db.scalar(select(Restaurant).where(Restaurant.user_id == user.id))
    if restaurant is not None:
        return restaurant
    restaurant = Restaurant(user_id=user.id)
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


def restaurant_to_iiko_public(restaurant: Restaurant, db: Session | None = None) -> IikoSettingsPublic:
    status_value, error = normalize_sync_status(restaurant)
    phase = None
    stock_public = StockSyncPublic(status="idle")

    if db is not None:
        phase = resolve_sync_phase(db, restaurant)
        stock_row = get_stock_domain_status(db, restaurant.id)
        latest = latest_stock_day(db, restaurant.id)
        tz = resolve_restaurant_timezone(restaurant.timezone)
        expected = expected_closed_sales_day(tz)
        lag = None if latest is None else max(0, (expected - latest).days)
        stock_public = StockSyncPublic(
            status=(stock_row.status if stock_row is not None else "idle"),  # type: ignore[arg-type]
            latest_day=latest,
            lag_days=lag,
            days_done=stock_row.days_done if stock_row is not None else None,
            error=stock_row.error if stock_row is not None else None,
        )

    return IikoSettingsPublic(
        restaurant_id=restaurant.id,
        configured=restaurant.iiko_configured,
        iiko_url=restaurant.iiko_url,
        iiko_login=restaurant.iiko_login,
        updated_at=restaurant.iiko_updated_at,
        sync=IikoSyncPublic(
            status=status_value,  # type: ignore[arg-type]
            started_at=restaurant.sync_started_at,
            finished_at=restaurant.last_sync_at,
            date_from=restaurant.last_sync_from,
            date_to=restaurant.last_sync_to,
            days_loaded=restaurant.last_sync_days,
            plan_from=restaurant.sync_plan_from,
            plan_to=restaurant.sync_plan_to,
            days_done=restaurant.sync_days_done,
            current_day=restaurant.sync_current_day,
            progress_percent=sync_progress_percent(restaurant),
            phase=phase,
            error=error,
            stock=stock_public,
        ),
    )


def _verify_iiko_credentials(url: str, login: str, password: str) -> None:
    try:
        with IikoClient(url=url, login=login, password=password, timeout=30) as _client:
            pass
    except IikoAuthError as exc:
        raise RestaurantError(
            status.HTTP_400_BAD_REQUEST,
            "Invalid iiko credentials",
            "invalid_iiko_credentials",
        ) from exc
    except IikoError as exc:
        raise RestaurantError(
            status.HTTP_502_BAD_GATEWAY,
            "Could not reach iiko server",
            "iiko_unreachable",
        ) from exc


def update_iiko_settings(
    db: Session,
    user: User,
    payload: UpdateIikoSettingsRequest,
) -> IikoSettingsPublic:
    restaurant = get_or_create_restaurant(db, user)

    password = payload.iiko_password
    if not password:
        if not restaurant.iiko_configured:
            raise RestaurantError(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "iiko_password is required for initial setup",
                "iiko_password_required",
            )
        _, _, password = restaurant.iiko_credentials()

    _verify_iiko_credentials(payload.iiko_url, payload.iiko_login, password)
    restaurant.set_iiko_credentials(payload.iiko_url, payload.iiko_login, password)
    db.commit()
    db.refresh(restaurant)
    return restaurant_to_iiko_public(restaurant, db)


def build_iiko_client(restaurant: Restaurant) -> IikoClient:
    url, login, password = restaurant.iiko_credentials()
    return IikoClient(url=url, login=login, password=password)


def start_iiko_sync(
    db: Session,
    user: User,
    *,
    full: bool = False,
) -> IikoSyncStartResponse:
    restaurant = get_or_create_restaurant(db, user)
    if not restaurant.iiko_configured:
        raise RestaurantError(
            status.HTTP_400_BAD_REQUEST,
            "Configure iiko connection first",
            "iiko_not_configured",
        )

    if not enqueue_sync(db, restaurant.id, full=full):
        raise RestaurantError(
            status.HTTP_409_CONFLICT,
            "Sync already in progress",
            "sync_in_progress",
        )

    db.refresh(restaurant)
    return IikoSyncStartResponse(started_at=datetime.now(UTC))


def schedule_iiko_sync(restaurant_id: uuid.UUID, *, full: bool = False) -> None:
    """Совместимость: обрабатывает очередь (full уже учтён при enqueue)."""
    del full  # enqueue already recorded queued vs queued_full
    process_queued_sync(restaurant_id)


def resolve_restaurant_id_for_user(db: Session, user_id: uuid.UUID) -> uuid.UUID:
    restaurant = db.scalar(select(Restaurant.id).where(Restaurant.user_id == user_id))
    if restaurant is None:
        raise RestaurantError(
            status.HTTP_404_NOT_FOUND,
            "Restaurant not found",
            "restaurant_not_found",
        )
    return restaurant
