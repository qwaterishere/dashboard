"""API страницы «Цели»."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.targets import TargetsData, TargetsUpsertRequest
from src.services.targets import build_targets, save_targets


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
        return save_targets(db, restaurant.id, payload)

    return router
