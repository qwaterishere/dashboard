"""HTTP: /api/data-freshness."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.data_freshness import DataFreshness
from src.services.data_freshness import build_data_freshness


def create_data_freshness_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=['Ops'])
    settings = get_settings()

    @router.get(
        '/api/data-freshness',
        response_model=DataFreshness,
        operation_id='getDataFreshness',
        summary='Актуальность продаж в БД относительно закрытого дня',
    )
    @limiter.limit(settings.rate_limit)
    def get_data_freshness(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> DataFreshness:
        return build_data_freshness(db, restaurant)

    return router
