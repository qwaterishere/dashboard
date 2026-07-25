from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.rest.dashboard_rest import (
    MetricBounds,
    MetricFact,
    MetricLfl,
    MetricName,
    MetricSeries,
)
from src.services.rest.dashboard_rest import (
    metric_bounds,
    metric_fact,
    metric_lfl,
    metric_series,
)

# Защита series от запросов «на 10 лет»: календарная сетка строится
# по всему диапазону, год — разумный потолок для дневного шага.
MAX_RANGE_DAYS = 366

_DATE_FROM = Query(description="Начало периода включительно (YYYY-MM-DD)")
_DATE_TO = Query(description="Конец периода включительно (YYYY-MM-DD)")


def _validate_range(date_from: date, date_to: date) -> None:
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must be on or before date_to",
        )
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period is limited to {MAX_RANGE_DAYS} days",
        )


def create_metrics_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Метрики (REST)"])
    settings = get_settings()

    # bounds объявлен ДО /{metric}: иначе «bounds» матчится как имя метрики
    @router.get(
        "/api/metrics/bounds",
        response_model=MetricBounds,
        summary="Края истории данных",
        description=(
            "Первый и последний день, за которые есть продажи. Слой метрик "
            "считает ровно по запрошенным датам, ничего не усекая, — "
            "клиент сверяется с bounds, чтобы не запрашивать периоды шире "
            "данных и не сравнивать lfl с полупустой базой."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_bounds(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> MetricBounds:
        return metric_bounds(db, restaurant.id)

    @router.get(
        "/api/metrics/{metric}",
        response_model=MetricFact,
        summary="Факт метрики за период",
        description=(
            "Одно число ровно за запрошенный период. Суммовые метрики "
            "(revenue/checks/guests) — один SQL-запрос только по своей "
            "колонке; avg-* — дробь из двух (Σвыручки / Σчеков за период, "
            "не средняя дневных средних). Правила единые с дашбордом: "
            "чеки и гости — только чеки с оплатой (paid_total > 0)."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_metric_fact(
        request: Request,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
    ) -> MetricFact:
        _validate_range(date_from, date_to)
        return metric_fact(db, restaurant.id, metric.value, date_from, date_to)

    @router.get(
        "/api/metrics/{metric}/lfl",
        response_model=MetricLfl,
        summary="Метрика против прошлого периода (лайк-фор-лайк)",
        description=(
            "Факт за период + факт за предшествующий период той же формы: "
            "полный месяц -> предыдущий полный; 1..N числа -> те же числа "
            "прошлого месяца; произвольный диапазон -> блок той же длины "
            "накануне. Оба значения сырые — дельту в % считает клиент. "
            "Покрытие базы данными не проверяется — см. /api/metrics/bounds."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_metric_lfl(
        request: Request,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
    ) -> MetricLfl:
        _validate_range(date_from, date_to)
        return metric_lfl(db, restaurant.id, metric.value, date_from, date_to)

    @router.get(
        "/api/metrics/{metric}/series",
        response_model=MetricSeries,
        summary="Ряд метрики по дням (для графика)",
        description=(
            "Значение метрики на каждый календарный день диапазона, "
            "сетка сплошная: день без продаж -> 0 (у дробей null). "
            f"Диапазон ограничен {MAX_RANGE_DAYS} днями."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_metric_series(
        request: Request,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
    ) -> MetricSeries:
        _validate_range(date_from, date_to)
        return metric_series(db, restaurant.id, metric.value, date_from, date_to)

    return router
