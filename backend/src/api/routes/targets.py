"""API «Цели» — ресурс /api/targets/{year}/{month} + list filters."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.csrf import require_trusted_origin
from src.api.deps import CurrentRestaurant, CurrentUser, get_db, require_roles
from src.api.errors import http_error
from src.core.config import get_settings
from src.schemas.targets import TargetsData, TargetsLockedList, TargetsUpsertRequest
from src.services.rbac import ROLE_ACCOUNTANT, ROLE_MANAGER, audit_event
from src.services.targets import (
    TARGETS_LOCKED_DETAIL,
    TargetsLockedError,
    build_targets,
    clear_targets,
    list_configured_targets,
    list_locked_targets,
    lock_targets,
    save_targets,
    unlock_targets,
)


def create_targets_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix='/api/targets', tags=['Цели'])
    settings = get_settings()
    write_deps = [
        Depends(require_trusted_origin),
        Depends(require_roles(ROLE_MANAGER, ROLE_ACCOUNTANT)),
    ]

    def _validate_ym(year: int, month: int, request: Request) -> None:
        if month < 1 or month > 12 or year < 2000 or year > 2100:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'invalid year/month',
                'invalid_year_month',
                request,
            )

    @router.get(
        '',
        response_model=TargetsData | TargetsLockedList,
        operation_id='listOrGetTargets',
        summary='Цели: месяц (query) или список ?status=locked|configured',
    )
    @limiter.limit(settings.rate_limit)
    def list_or_get_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = Query(default=None, ge=2000, le=2100),
        month: int | None = Query(default=None, ge=1, le=12),
        status_filter: str | None = Query(default=None, alias='status'),
    ) -> TargetsData | TargetsLockedList:
        if status_filter == 'locked':
            return list_locked_targets(db, restaurant.id)
        if status_filter == 'configured':
            return list_configured_targets(db, restaurant.id)
        if status_filter is not None:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'status must be locked|configured',
                'invalid_status_filter',
                request,
            )
        if (year is None) ^ (month is None):
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'year and month must be provided together',
                'year_month_required_together',
                request,
            )
        return build_targets(db, restaurant.id, year=year, month=month)

    @router.get(
        '/{year}/{month}',
        response_model=TargetsData,
        operation_id='getTargetsMonth',
        summary='Цели на месяц',
    )
    @limiter.limit(settings.rate_limit)
    def get_targets_month(
        request: Request,
        year: int,
        month: int,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsData:
        _validate_ym(year, month, request)
        return build_targets(db, restaurant.id, year=year, month=month)

    @router.put(
        '/{year}/{month}',
        response_model=TargetsData,
        operation_id='putTargetsMonth',
        summary='Сохранить цели месяца',
        dependencies=write_deps,
    )
    @limiter.limit(settings.rate_limit)
    def put_targets_month(
        request: Request,
        year: int,
        month: int,
        payload: TargetsUpsertRequest,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsData:
        _validate_ym(year, month, request)
        if payload.year != year or payload.month != month:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'path year/month must match body',
                'path_body_mismatch',
                request,
            )
        try:
            return save_targets(db, restaurant.id, payload)
        except TargetsLockedError:
            raise http_error(
                status.HTTP_409_CONFLICT,
                TARGETS_LOCKED_DETAIL,
                'targets_locked',
                request,
            ) from None

    @router.post(
        '/{year}/{month}/lock',
        response_model=TargetsData,
        operation_id='lockTargetsMonth',
        dependencies=write_deps,
    )
    @limiter.limit(settings.rate_limit)
    def post_lock_month(
        request: Request,
        year: int,
        month: int,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsData:
        _validate_ym(year, month, request)
        try:
            result = lock_targets(db, restaurant.id, year=year, month=month)
        except ValueError:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'Cannot lock empty targets',
                'cannot_lock_empty',
                request,
            ) from None
        audit_event(
            action='targets.lock',
            user_id=_user.id,
            restaurant_id=restaurant.id,
            detail=f'{year}-{month:02d}',
        )
        return result

    @router.delete(
        '/{year}/{month}/lock',
        response_model=TargetsData,
        operation_id='unlockTargetsMonth',
        summary='Снять блокировку (DELETE lock)',
        dependencies=write_deps,
    )
    @limiter.limit(settings.rate_limit)
    def delete_lock_month(
        request: Request,
        year: int,
        month: int,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsData:
        _validate_ym(year, month, request)
        result = unlock_targets(db, restaurant.id, year=year, month=month)
        audit_event(
            action='targets.unlock',
            user_id=_user.id,
            restaurant_id=restaurant.id,
            detail=f'{year}-{month:02d}',
        )
        return result

    @router.delete(
        '/{year}/{month}',
        response_model=TargetsData,
        operation_id='deleteTargetsMonth',
        dependencies=write_deps,
    )
    @limiter.limit(settings.rate_limit)
    def delete_targets_month(
        request: Request,
        year: int,
        month: int,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsData:
        _validate_ym(year, month, request)
        try:
            return clear_targets(db, restaurant.id, year=year, month=month)
        except TargetsLockedError:
            raise http_error(
                status.HTTP_409_CONFLICT,
                TARGETS_LOCKED_DETAIL,
                'targets_locked',
                request,
            ) from None

    return router
