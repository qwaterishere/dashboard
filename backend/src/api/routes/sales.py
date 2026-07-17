from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
        summary="Позиции за период: порции, выручка, себестоимость",
        description=(
            "Агрегат по позициям за период. Факты — qty/revenue/cost; "
            "производные (цена порции, gp, fc, доли, ABC) считает фронтенд; "
            "price/unitCost — legacy-средние до миграции фронта на суммы.\n\n"
            "Период: канон — явные date_from/date_to (пара) во всех режимах; "
            "без параметров — месяц последнего закрытого дня (страховка). "
            "Даты усекаются краями данных, эффективные границы — в period."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_sales(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date | None = Query(
            default=None,
            description="Начало периода; только вместе с date_to. "
            "Усекается началом истории данных",
        ),
        date_to: date | None = Query(
            default=None,
            description="Конец периода; только вместе с date_from. "
            "Усекается последним закрытым днём",
        ),
    ) -> SalesPage:
        if (date_from is None) ^ (date_to is None):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="date_from and date_to must be provided together",
            )
        return build_sales(db, restaurant.id, date_from, date_to)

    return router
