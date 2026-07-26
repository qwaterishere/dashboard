"""REST /api/stock/* — складские слепки."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.api.errors import http_error
from src.core.config import get_settings
from src.schemas.stock import (
    DynamicsPoint,
    NegativeStock,
    StockPosition,
    StockSnapshot,
    StoreValue,
)
from src.services.stock import (
    SnapshotNotFound,
    build_stock_snapshot,
    stock_bounds,
    stock_dynamics_range,
    stock_negative,
    stock_positions,
    stock_totals,
)


def create_stock_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix='/api/stock', tags=['Склад'])
    settings = get_settings()

    def _http(exc: SnapshotNotFound, request: Request):
        return http_error(
            status.HTTP_404_NOT_FOUND,
            str(exc),
            'stock_snapshot_not_found',
            request,
        )

    @router.get(
        '/bounds',
        operation_id='getStockBounds',
        summary='Края истории слепков склада',
    )
    @limiter.limit(settings.rate_limit)
    def get_stock_bounds(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> dict:
        try:
            return stock_bounds(db, restaurant.id)
        except SnapshotNotFound as exc:
            raise _http(exc, request) from exc

    @router.get(
        '/snapshot',
        response_model=StockSnapshot,
        operation_id='getStockSnapshot',
        summary='Снимок склада: totals + positions + dynamics (1 RTT)',
    )
    @limiter.limit(settings.rate_limit)
    def get_stock_snapshot(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        as_of: date | None = Query(None, alias='date'),
        date_from: date | None = Query(None, description='Начало dynamics'),
        date_to: date | None = Query(None, description='Конец dynamics'),
    ) -> StockSnapshot:
        try:
            return build_stock_snapshot(
                db, restaurant.id, on_date=as_of, dyn_from=date_from, dyn_to=date_to,
            )
        except SnapshotNotFound as exc:
            raise _http(exc, request) from exc

    @router.get(
        '/totals',
        response_model=list[StoreValue],
        operation_id='getStockTotals',
    )
    @limiter.limit(settings.rate_limit)
    def get_stock_totals(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        as_of: date | None = Query(None, alias='date'),
    ) -> list[StoreValue]:
        try:
            return stock_totals(db, restaurant.id, as_of)
        except SnapshotNotFound as exc:
            raise _http(exc, request) from exc

    @router.get(
        '/positions',
        response_model=list[StockPosition],
        operation_id='getStockPositions',
    )
    @limiter.limit(settings.rate_limit)
    def get_stock_positions(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        as_of: date | None = Query(None, alias='date'),
    ) -> list[StockPosition]:
        try:
            return stock_positions(db, restaurant.id, as_of)
        except SnapshotNotFound as exc:
            raise _http(exc, request) from exc

    @router.get(
        '/negative',
        response_model=NegativeStock,
        operation_id='getStockNegative',
    )
    @limiter.limit(settings.rate_limit)
    def get_stock_negative(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        as_of: date | None = Query(None, alias='date'),
    ) -> NegativeStock:
        try:
            return stock_negative(db, restaurant.id, as_of)
        except SnapshotNotFound as exc:
            raise _http(exc, request) from exc

    @router.get(
        '/dynamics',
        response_model=list[DynamicsPoint],
        operation_id='getStockDynamics',
    )
    @limiter.limit(settings.rate_limit)
    def get_stock_dynamics(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date | None = Query(None),
        date_to: date | None = Query(None),
        as_of: date | None = Query(None, alias='date'),
    ) -> list[DynamicsPoint]:
        try:
            return stock_dynamics_range(
                db,
                restaurant.id,
                on_date=as_of,
                dyn_from=date_from,
                dyn_to=date_to,
            )
        except SnapshotNotFound as exc:
            raise _http(exc, request) from exc

    return router
