"""Ресторан пользователя и настройки iiko."""

from __future__ import annotations

import uuid

from datetime import UTC, datetime

from fastapi import HTTPException, status
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
    UpdateIikoSettingsRequest,
)
from src.services.iiko_sync import normalize_sync_status, sync_progress_percent


def get_or_create_restaurant(db: Session, user: User) -> Restaurant:
    restaurant = db.scalar(select(Restaurant).where(Restaurant.user_id == user.id))
    if restaurant is not None:
        return restaurant
    restaurant = Restaurant(user_id=user.id)
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


def restaurant_to_iiko_public(restaurant: Restaurant) -> IikoSettingsPublic:
    status_value, error = normalize_sync_status(restaurant)
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
            error=error,
        ),
    )


def _verify_iiko_credentials(url: str, login: str, password: str) -> None:
    try:
        with IikoClient(url=url, login=login, password=password, timeout=30) as _client:
            pass
    except IikoAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid iiko credentials",
        ) from exc
    except IikoError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach iiko server",
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
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="iiko_password is required for initial setup",
            )
        _, _, password = restaurant.iiko_credentials()

    _verify_iiko_credentials(payload.iiko_url, payload.iiko_login, password)
    restaurant.set_iiko_credentials(payload.iiko_url, payload.iiko_login, password)
    db.commit()
    db.refresh(restaurant)
    return restaurant_to_iiko_public(restaurant)


def build_iiko_client(restaurant: Restaurant) -> IikoClient:
    url, login, password = restaurant.iiko_credentials()
    return IikoClient(url=url, login=login, password=password)


def start_iiko_sync(db: Session, user: User) -> IikoSyncStartResponse:
    restaurant = get_or_create_restaurant(db, user)
    if not restaurant.iiko_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configure iiko connection first",
        )

    status_value, _ = normalize_sync_status(restaurant)
    if status_value == "running":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sync already in progress",
        )

    started_at = datetime.now(UTC)
    restaurant.sync_status = "running"
    restaurant.sync_started_at = started_at
    restaurant.last_sync_error = None
    db.commit()

    return IikoSyncStartResponse(started_at=started_at)


def schedule_iiko_sync(restaurant_id: uuid.UUID, *, full: bool = False) -> None:
    """Вызывается из BackgroundTasks после commit статуса running."""
    from src.services.iiko_sync import run_sync_job

    run_sync_job(restaurant_id, full=full)


def resolve_restaurant_id_for_user(db: Session, user_id: uuid.UUID) -> uuid.UUID:
    restaurant = db.scalar(select(Restaurant.id).where(Restaurant.user_id == user_id))
    if restaurant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found",
        )
    return restaurant
