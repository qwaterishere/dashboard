"""Интеграции ресторана: iiko (вынесено из /api/auth/me/iiko)."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.csrf import require_trusted_origin
from src.api.deps import CurrentUser, get_db, require_roles
from src.api.errors import http_error
from src.core.config import get_settings
from src.schemas.restaurant import (
    IikoSettingsPublic,
    IikoSyncStartResponse,
    UpdateIikoSettingsRequest,
)
from src.services.errors import RestaurantError
from src.services.iiko_sync import process_queued_sync
from src.services.rbac import ROLE_MANAGER
from src.services.restaurant import (
    get_or_create_restaurant,
    restaurant_to_iiko_public,
    start_iiko_sync,
    update_iiko_settings,
)


def create_integrations_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix='/api/integrations', tags=['Integrations'])
    settings = get_settings()
    write_deps = [
        Depends(require_trusted_origin),
        Depends(require_roles(ROLE_MANAGER)),
    ]

    @router.get(
        '/iiko',
        response_model=IikoSettingsPublic,
        operation_id='getIikoIntegration',
        summary='Настройки подключения iiko',
    )
    @limiter.limit(settings.rate_limit)
    def get_iiko(
        request: Request,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> IikoSettingsPublic:
        restaurant = get_or_create_restaurant(db, user)
        return restaurant_to_iiko_public(restaurant, db)

    @router.put(
        '/iiko',
        response_model=IikoSettingsPublic,
        operation_id='putIikoIntegration',
        summary='Сохранить подключение iiko',
        dependencies=write_deps,
    )
    @limiter.limit('5/minute')
    def put_iiko(
        request: Request,
        payload: UpdateIikoSettingsRequest,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> IikoSettingsPublic:
        try:
            return update_iiko_settings(db, user, payload)
        except RestaurantError as exc:
            raise http_error(exc.status_code, exc.detail, exc.code) from None

    @router.post(
        '/iiko/sync',
        response_model=IikoSyncStartResponse,
        status_code=status.HTTP_202_ACCEPTED,
        operation_id='syncIikoIntegration',
        summary='Загрузить продажи и склад из iiko',
        dependencies=write_deps,
    )
    @limiter.limit('3/minute')
    def sync_iiko(
        request: Request,
        background_tasks: BackgroundTasks,
        user: CurrentUser,
        db: Session = Depends(get_db),
        full: bool = Query(False),
    ) -> IikoSyncStartResponse:
        restaurant = get_or_create_restaurant(db, user)
        try:
            response = start_iiko_sync(db, user, full=full)
        except RestaurantError as exc:
            raise http_error(exc.status_code, exc.detail, exc.code) from None

        cfg = get_settings()
        # Production (and SYNC_RUN_IN_API=false): worker drains the queue.
        if cfg.is_production or not cfg.sync_run_in_api:
            return response

        background_tasks.add_task(process_queued_sync, restaurant.id)
        return response

    return router
