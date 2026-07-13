from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.foodcost import Foodcost
from src.services.foodcost import build_food_cost


def create_foodcost_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Фудкост"])
    settings = get_settings()

    @router.get(
        "/api/foodcost",
        response_model=Foodcost,
        summary="Фудкост: тоталы, юниты, группы, скидки, потери (фаза 1)",
        description=(
            "Факты фудкоста за период; производные считает фронтенд: "
            "fc = cost / revenueWithCost, покрытие = revenueWithCost / revenue, "
            "LfL из prev*-полей.\n\n"
            "Правило учёта строк: выручка — строки paid > 0; фудкост (cost "
            "и revenueWithCost) — строки paid > 0 И cost > 0, поэтому позиции "
            "без техкарт фудкост не размывают.\n\n"
            "Семантика пустоты: null — данных/модуля нет (dirty и writeoffs — "
            "фаза 2, goal — до модуля targets, prev* — сравнивать не с чем); "
            "0 — честный ноль из данных."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_foodcost(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = Query(
            default=None, ge=2000, le=2100,
            description="Год периода; без month — с 1 января по последний "
            "закрытый день года",
        ),
        month: int | None = Query(
            default=None, ge=1, le=12,
            description="Месяц 1..12 (требует year); без параметров — "
            "месяц последнего закрытого дня",
        ),
    ) -> Foodcost:
        if month is not None and year is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="year is required when month is set",
            )

        try:
            return build_food_cost(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

    return router
