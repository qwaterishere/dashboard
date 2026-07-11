from datetime import date

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.sales import SalesPage
from src.services.sales import build_sales


def create_sales_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Продажи"])
    settings = get_settings()

    @router.get(
        "/api/sales",
        response_model=SalesPage,
        summary="Позиции за период: порции, цены, себестоимость",
    )
    @limiter.limit(settings.rate_limit)
    def get_sales(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> SalesPage:
        return build_sales(db, restaurant.id, date_from, date_to)

    return router
