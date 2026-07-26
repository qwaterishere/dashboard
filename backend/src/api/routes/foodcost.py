"""REST /api/foodcost/* — факты фудкоста."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.api.errors import http_error
from src.core.config import get_settings
from src.schemas.foodcost import (
    CostTotals,
    Foodcost,
    GroupCost,
    ProductCost,
    UnitCost,
)
from src.services.foodcost import (
    build_food_cost,
    foodcost_groups,
    foodcost_products,
    foodcost_totals,
    foodcost_units,
)


def create_foodcost_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix='/api/foodcost', tags=['Фудкост'])
    settings = get_settings()

    def _validate_ym(year: int | None, month: int | None, request: Request) -> None:
        if month is not None and year is None:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'year is required when month is set',
                'year_required_with_month',
                request,
            )

    def _domain(exc: ValueError, request: Request):
        return http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            str(exc),
            'foodcost_domain',
            request,
        )

    year_q = Query(None, ge=2000, le=2100)
    month_q = Query(None, ge=1, le=12)

    @router.get(
        '/snapshot',
        response_model=Foodcost,
        operation_id='getFoodcostSnapshot',
        summary='Снимок фудкоста (1 RTT)',
    )
    @limiter.limit(settings.rate_limit)
    def get_foodcost_snapshot(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = year_q,
        month: int | None = month_q,
    ) -> Foodcost:
        _validate_ym(year, month, request)
        try:
            return build_food_cost(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise _domain(exc, request) from exc

    @router.get('/totals', response_model=CostTotals, operation_id='getFoodcostTotals')
    @limiter.limit(settings.rate_limit)
    def get_totals(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = year_q,
        month: int | None = month_q,
    ) -> CostTotals:
        _validate_ym(year, month, request)
        try:
            return foodcost_totals(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise _domain(exc, request) from exc

    @router.get('/units', response_model=list[UnitCost], operation_id='getFoodcostUnits')
    @limiter.limit(settings.rate_limit)
    def get_units(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = year_q,
        month: int | None = month_q,
    ) -> list[UnitCost]:
        _validate_ym(year, month, request)
        try:
            return foodcost_units(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise _domain(exc, request) from exc

    @router.get('/groups', response_model=list[GroupCost], operation_id='getFoodcostGroups')
    @limiter.limit(settings.rate_limit)
    def get_groups(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = year_q,
        month: int | None = month_q,
    ) -> list[GroupCost]:
        _validate_ym(year, month, request)
        try:
            return foodcost_groups(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise _domain(exc, request) from exc

    @router.get(
        '/products',
        response_model=list[ProductCost],
        operation_id='getFoodcostProducts',
    )
    @limiter.limit(settings.rate_limit)
    def get_products(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = year_q,
        month: int | None = month_q,
    ) -> list[ProductCost]:
        _validate_ym(year, month, request)
        try:
            return foodcost_products(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise _domain(exc, request) from exc

    return router
