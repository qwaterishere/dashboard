"""REST /api/sales/* — позиции продаж."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.api.errors import http_error
from src.core.config import get_settings
from src.schemas.sales import SalesPage, SalesPosition
from src.services.sales import build_sales, list_sales_positions


def create_sales_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix='/api/sales', tags=['Продажи'])
    settings = get_settings()

    def _validate_range(
        date_from: date | None,
        date_to: date | None,
        request: Request,
    ) -> None:
        if (date_from is None) ^ (date_to is None):
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'date_from and date_to must be provided together',
                'date_range_incomplete',
                request,
            )

    @router.get(
        '/snapshot',
        response_model=SalesPage,
        operation_id='getSalesSnapshot',
        summary='Снимок продаж: период + позиции (1 RTT)',
    )
    @limiter.limit(settings.rate_limit)
    def get_sales_snapshot(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date | None = Query(None),
        date_to: date | None = Query(None),
    ) -> SalesPage:
        _validate_range(date_from, date_to, request)
        return build_sales(db, restaurant.id, date_from, date_to)

    @router.get(
        '/positions',
        response_model=list[SalesPosition],
        operation_id='getSalesPositions',
        summary='Позиции продаж за период',
    )
    @limiter.limit(settings.rate_limit)
    def get_sales_positions(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date | None = Query(None),
        date_to: date | None = Query(None),
    ) -> list[SalesPosition]:
        _validate_range(date_from, date_to, request)
        return list_sales_positions(db, restaurant.id, date_from, date_to)

    return router
