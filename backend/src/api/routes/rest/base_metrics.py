from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.rest.base_metrics import (
    MetricBounds,
    MetricFact,
    MetricLfl,
    MetricName,
    MetricSeries,
)
from src.services.rest.base_metrics import (
    metric_bounds,
    metric_fact,
    metric_lfl,
    metric_series,
)

# TODO(review): константа заявлена для series, но применяется и к fact/lfl.
#   Fact/compare — O(1) aggregate; год ОБЯЗАН быть валиден.
# Исправление (MUST): MAX_SERIES_DAYS; длина только в get_metric_series.
#   Для fact/compare — только date_from <= date_to. Жёсткий потолок на fact
#   не маскировать под 366: либо нет лимита, либо отдельный anti-abuse
#   (напр. 5 лет) + явный код ошибки в контракте.
MAX_RANGE_DAYS = 366

# TODO(review): examples= в OpenAPI; date_from/date_to — явно required.
# TODO(review): один язык и формат ошибок API ({detail, code, request_id}).
_DATE_FROM = Query(description="Начало периода включительно (YYYY-MM-DD)")
_DATE_TO = Query(description="Конец периода включительно (YYYY-MM-DD)")


def _validate_range(date_from: date, date_to: date) -> None:
    # TODO(review): MUST разделить _validate_ordered и _validate_series_span —
    #   иначе fact за год стабильно ломается.
    if date_from > date_to:
        raise HTTPException(
            # TODO(review): Starlette — HTTP_422_UNPROCESSABLE_CONTENT.
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            # TODO(review): единый error envelope backend — MUST для прода.
            detail="date_from must be on or before date_to",
        )
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period is limited to {MAX_RANGE_DAYS} days",
        )


def create_base_metrics_router(limiter: Limiter) -> APIRouter:
    # TODO(review): MUST — APIRouter(prefix="/api/base-metrics") + короткие path.
    router = APIRouter(tags=["Базовые метрики (REST)"])
    settings = get_settings()

    # bounds ДО /{metric}: иначе «bounds» = имя метрики
    @router.get(
        "/api/base-metrics/bounds",
        response_model=MetricBounds,
        # TODO(review): operationId на каждом хендлере — MUST до TS-клиента.
        summary="Края истории данных",
        description=(
            # TODO(review): убрать намёк на «закрытый день». Код = min/max(Order.day).
            "Первый и последний день, за которые есть продажи. Слой метрик "
            "считает ровно по запрошенным датам, ничего не усекая, — "
            "клиент сверяется с bounds, чтобы не запрашивать периоды шире "
            "данных и не сравнивать lfl с полупустой базой."
        ),
        # TODO(review): responses={401,403,422} в OpenAPI — MUST.
    )
    @limiter.limit(settings.rate_limit)
    def get_bounds(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> MetricBounds:
        # TODO(review): ETag/Cache-Control — MUST для клиентской сборки Дашборда
        #   (не «после стабилизации»). Ключ: restaurant_id + max(Order.day).
        return metric_bounds(db, restaurant.id)

    @router.get(
        "/api/base-metrics/{metric}",
        response_model=MetricFact,
        summary="Факт метрики за период",
        description=(
            "Одно число ровно за запрошенный период. Суммовые метрики "
            "(revenue/checks/guests) — один SQL-запрос только по своей "
            "колонке; avg-* — дробь из двух (Σвыручки / Σчеков за период, "
            "не средняя дневных средних). Правила единые с дашбордом: "
            # TODO(review): фраза «единые с дашбордом» ЛОЖНА — УДАЛИТЬ.
            #   Канон REST: avg → null при 0 знаменателе. Записать в
            #   OpenAPI + docs/frontend-handoff.md.
            # TODO(review): КРИТИЧНО — /api/sales УСЕКАЕТ даты краями данных,
            #   этот слой НЕТ. Явно описать в контракте, иначе «тихие нули».
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
        # TODO(review): лимит 366 на fact — БАГ. Только порядок дат.
        _validate_range(date_from, date_to)
        # TODO(review): snapshot-тест OpenAPI: enum содержит "avg-check".
        # TODO(review): service MUST возвращать Pydantic, не dict.
        return metric_fact(db, restaurant.id, metric.value, date_from, date_to)

    @router.get(
        "/api/base-metrics/{metric}/lfl",
        response_model=MetricLfl,
        summary="Метрика против прошлого периода (лайк-фор-лайк)",
        description=(
            # TODO(review): MUST переименовать в /compare; /lfl — deprecated
            #   alias + заголовки Deprecation/Sunset. Query base_from+base_to
            #   (оба или ни одного); иначе previous_period.
            "Факт за период + факт за предшествующий период той же формы: "
            "полный месяц -> предыдущий полный; 1..N числа -> те же числа "
            "прошлого месяца; произвольный диапазон -> блок той же длины "
            "накануне. Оба значения сырые — дельту в % считает клиент. "
            "Покрытие базы данными не проверяется — см. /api/base-metrics/bounds."
            # TODO(review): base_incomplete: bool в ответе — MUST.
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
        # TODO(review): лимит 366 на compare — БАГ, убрать.
        _validate_range(date_from, date_to)
        # TODO(review): ValueError → HTTP 422 (единый domain→HTTP mapping).
        return metric_lfl(db, restaurant.id, metric.value, date_from, date_to)

    @router.get(
        "/api/base-metrics/{metric}/series",
        response_model=MetricSeries,
        summary="Ряд метрики по дням (для графика)",
        description=(
            "Значение метрики на каждый календарный день диапазона, "
            "сетка сплошная: день без продаж -> 0 (у дробей null). "
            f"Диапазон ограничен {MAX_RANGE_DAYS} днями."
            # TODO(review): granularity=month — MUST для годового графика.
            #   Один способ в контракте: query granularity (не «или отдельный»).
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
        # TODO(review): лимит дней — только здесь. ETag на series — MUST.
        # TODO(review): month — свой потолок (напр. 36) и код 422.
        _validate_range(date_from, date_to)
        return metric_series(db, restaurant.id, metric.value, date_from, date_to)

    # TODO(review): вынести helper периода ДО batch — иначе batch скопирует дубль.
    return router


# ---------------------------------------------------------------------------
# TODO(review): недостающее для «Дашборд» (сборка на клиенте из REST).
#   Всё с пометкой MUST — до cutover фронта, не «когда-нибудь».
#
# 1) GET /api/base-metrics/batch  [MUST]
#      metrics=…&date_from&date_to&include_compare&base_from&base_to
#    Без batch = 4–8 round-trips. Лимит CSV (≤10). SQL: 1–2 totals.
#    Отдельный вес в rate-limit.
#
# 2) GET /api/base-metrics/period/default  [MUST]
# 3) GET /api/base-metrics/units  [MUST] — через analytics.queries.unit_sums
# 4) GET /api/base-metrics/{metric}/forecast  [MUST для паритета KPI]
#      analytics/forecast.py; план только /api/targets
# 5) /compare + deprecated /lfl  [MUST]
# 6) series?granularity=day|month  [MUST]
#
# 7) Фронт сам: /api/targets, /api/foodcost, /api/warehouse, /api/data-freshness
#
# 8) Week API не плодить без продукта. В handoff: week = даты + compare
#    на клиенте. Иначе снова god-endpoint.
#
# 9) analytics/queries.py + forecast.py  [MUST до sales_metrics]
#    dashboard.py → queries, дубли SQL удалить. Иначе REST ≠ dashboard.
#
# 10) tests/test_base_metrics_rest.py  [MUST, иначе не мержить]
#       tenant; empty; avg null; без round(revenue); series length;
#       fact год=200; compare base_*; batch SQL≤2; OpenAPI avg-check;
#       total vs Σ(daily); контраст с /api/sales (усечение дат).
#
# 11) docs/frontend-handoff.md: N вызовов Дашборда; deprecate /api/dashboard*;
#       Sunset на /lfl.
#
# 12) OpenAPI info.version + BACKEND_CHANGELOG на breaking
#       (avg null, snake_case, без усечения дат).
#
# 13) request_id в логах и error envelope — MUST для прода.
#
# 14) Деньги: Decimal (или строка JSON) — float для money на 10/10 недопустим.
#
# 15) В контракте: Order.day = календарный бизнес-день заведения, не UTC ts.
# ---------------------------------------------------------------------------
