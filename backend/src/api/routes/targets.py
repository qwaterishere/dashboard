"""API страницы «Цели»."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.targets import TargetsData, TargetsLockedList, TargetsUpsertRequest
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
    router = APIRouter(tags=["Цели"])
    settings = get_settings()

    @router.get(
        "/api/targets",
        response_model=TargetsData,
        summary="Цели на месяц (план выручки, фудкост, потери)",
    )
    @limiter.limit(settings.rate_limit)
    def get_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = Query(default=None, ge=2000, le=2100),
        month: int | None = Query(default=None, ge=1, le=12),
    ) -> TargetsData:
        if (year is None) ^ (month is None):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="year and month must be provided together",
            )
        return build_targets(db, restaurant.id, year=year, month=month)

    @router.get(
        "/api/targets/locks",
        response_model=TargetsLockedList,
        summary="Список заблокированных месяцев",
    )
    @limiter.limit(settings.rate_limit)
    def get_locked_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsLockedList:
        return list_locked_targets(db, restaurant.id)

    @router.get(
        "/api/targets/configured",
        response_model=TargetsLockedList,
        summary="Список месяцев с заданными целями (план выручки > 0)",
    )
    @limiter.limit(settings.rate_limit)
    def get_configured_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsLockedList:
        return list_configured_targets(db, restaurant.id)

    @router.put(
        "/api/targets",
        response_model=TargetsData,
        summary="Сохранить цели месяца (без наследования из прошлого месяца)",
    )
    @limiter.limit(settings.rate_limit)
    def put_targets(
        request: Request,
        payload: TargetsUpsertRequest,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> TargetsData:
        try:
            return save_targets(db, restaurant.id, payload)
        except TargetsLockedError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=TARGETS_LOCKED_DETAIL,
            ) from None

    @router.post(
        "/api/targets/lock",
        response_model=TargetsData,
        summary="Заблокировать цели месяца",
    )
    @limiter.limit(settings.rate_limit)
    def post_lock_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int = Query(ge=2000, le=2100),
        month: int = Query(ge=1, le=12),
    ) -> TargetsData:
        try:
            return lock_targets(db, restaurant.id, year=year, month=month)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot lock empty targets",
            ) from None

    @router.post(
        "/api/targets/unlock",
        response_model=TargetsData,
        summary="Разблокировать цели месяца",
    )
    @limiter.limit(settings.rate_limit)
    def post_unlock_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int = Query(ge=2000, le=2100),
        month: int = Query(ge=1, le=12),
    ) -> TargetsData:
        return unlock_targets(db, restaurant.id, year=year, month=month)

    @router.delete(
        "/api/targets",
        response_model=TargetsData,
        summary="Сбросить цели месяца (удалить настройку)",
    )
    @limiter.limit(settings.rate_limit)
    def delete_targets(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int = Query(ge=2000, le=2100),
        month: int = Query(ge=1, le=12),
    ) -> TargetsData:
        try:
            return clear_targets(db, restaurant.id, year=year, month=month)
        except TargetsLockedError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=TARGETS_LOCKED_DETAIL,
            ) from None

    return router
