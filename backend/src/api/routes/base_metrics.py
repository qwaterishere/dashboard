"""HTTP-маршруты /api/base-metrics/*."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.api.errors import http_error
from src.core.config import get_settings
from src.schemas.base_metrics import (
    DefaultPeriod,
    MetricBatch,
    MetricBounds,
    MetricCompare,
    MetricFact,
    MetricForecast,
    MetricName,
    MetricSeries,
    MetricSnapshot,
    SeriesGranularity,
    SnapshotMode,
    UnitsResponse,
)
from src.services.analytics.queries import data_bounds, resolve_period
from src.services.base_metrics import (
    MAX_FACT_DAYS,
    assert_fact_span,
    metric_batch,
    metric_bounds,
    metric_compare,
    metric_default_period,
    metric_fact,
    metric_forecast,
    metric_series,
    metric_snapshot,
    metric_units,
)

MAX_SERIES_DAYS = 366
MAX_SERIES_MONTHS = 36

# Тяжёлые эндпоинты — отдельный более жёсткий лимит.
_HEAVY_LIMIT = '30/minute'

_DATE_FROM = Query(
    ...,
    description='Начало периода включительно (YYYY-MM-DD)',
    examples=['2026-06-01'],
)
_DATE_TO = Query(
    ...,
    description='Конец периода включительно (YYYY-MM-DD)',
    examples=['2026-06-30'],
)

_OPENAPI_AUTH = {
    401: {'description': 'Unauthorized'},
    403: {'description': 'Forbidden'},
    422: {'description': 'Validation error'},
    304: {'description': 'Not Modified'},
}


def _validate_ordered(date_from: date, date_to: date) -> None:
    if date_from > date_to:
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            'date_from must be on or before date_to',
            'base_metrics_validation',
        )


def _validate_series_span(
    date_from: date,
    date_to: date,
    granularity: SeriesGranularity,
) -> None:
    _validate_ordered(date_from, date_to)
    if granularity == SeriesGranularity.day:
        span = (date_to - date_from).days + 1
        if span > MAX_SERIES_DAYS:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                f'series day span is limited to {MAX_SERIES_DAYS} days',
                'base_metrics_validation',
            )
        return

    months = (date_to.year - date_from.year) * 12 + (date_to.month - date_from.month) + 1
    if months > MAX_SERIES_MONTHS:
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f'series month span is limited to {MAX_SERIES_MONTHS} months',
            'base_metrics_validation',
        )


def _validate_base_pair(base_from: date | None, base_to: date | None) -> None:
    if (base_from is None) ^ (base_to is None):
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            'base_from and base_to must be provided together',
            'base_metrics_validation',
        )
    if base_from is not None and base_to is not None:
        _validate_ordered(base_from, base_to)


def _domain_http(exc: ValueError, *, request: Request | None = None):
    """Единый envelope для domain-ошибок base-metrics."""
    return http_error(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        str(exc),
        'base_metrics_domain',
        request,
    )


def _parse_metrics(raw: list[MetricName] | None, csv: str | None) -> list[MetricName]:
    if raw:
        if len(raw) > 10:
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'metrics is limited to 10 names',
                'base_metrics_validation',
            )
        return raw
    if not csv:
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            'metrics must list at least one name',
            'base_metrics_validation',
        )
    parts = [p.strip() for p in csv.split(',') if p.strip()]
    if not parts:
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            'metrics must list at least one name',
            'base_metrics_validation',
        )
    if len(parts) > 10:
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            'metrics is limited to 10 names',
            'base_metrics_validation',
        )
    try:
        return [MetricName(p) for p in parts]
    except ValueError as exc:
        raise http_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f'unknown metric in metrics: {exc}',
            'base_metrics_validation',
        ) from exc


def _etag(restaurant_id: UUID, earliest: date | None, latest: date | None) -> str:
    if latest is None:
        return 'W/"base-metrics:empty"'
    return f'W/"base-metrics:{restaurant_id}:{earliest}:{latest}"'


def _apply_cache(response: Response, etag: str) -> None:
    response.headers['ETag'] = etag
    response.headers['Cache-Control'] = 'private, no-cache'


def _not_modified(request: Request, etag: str) -> Response | None:
    client = request.headers.get('if-none-match')
    if client and client == etag:
        return Response(
            status_code=304,
            headers={'ETag': etag, 'Cache-Control': 'private, no-cache'},
        )
    return None


def create_base_metrics_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(
        prefix='/api/base-metrics',
        tags=['Базовые метрики (REST)'],
    )
    settings = get_settings()
    light = settings.rate_limit

    @router.get(
        '/bounds',
        response_model=MetricBounds,
        operation_id='getBaseMetricsBounds',
        summary='Края истории данных',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(light)
    def get_bounds(
        request: Request,
        response: Response,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> MetricBounds | Response:
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        return MetricBounds(date_from=earliest, date_to=latest)

    @router.get(
        '/period/default',
        response_model=DefaultPeriod,
        operation_id='getBaseMetricsDefaultPeriod',
        summary='Период по умолчанию (месяц последних данных)',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(light)
    def get_default_period(
        request: Request,
        response: Response,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> DefaultPeriod | Response:
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        return metric_default_period(db, restaurant.id)

    @router.get(
        '/snapshot',
        response_model=MetricSnapshot,
        operation_id='getBaseMetricsSnapshot',
        summary='Снимок метрик для дашборда (один round-trip)',
        description=(
            'Собирает bounds, batch+compare, units, day/month series и forecast '
            'за один запрос. mode=full|chart|kpi. '
            'Период: date_from+date_to, либо year[/month], либо месяц последних данных. '
            f'Спан ≤ {MAX_FACT_DAYS} дней.'
        ),
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(_HEAVY_LIMIT)
    def get_snapshot(
        request: Request,
        response: Response,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date | None = Query(None, description='Явный период (вместе с date_to)'),
        date_to: date | None = Query(None),
        year: int | None = Query(None, ge=2000, le=2100),
        month: int | None = Query(None, ge=1, le=12),
        mode: SnapshotMode = Query(SnapshotMode.full),
        base_from: date | None = Query(None),
        base_to: date | None = Query(None),
        week_start: date | None = Query(None),
        week_end: date | None = Query(None),
        anchor_year: int | None = Query(None, ge=2000, le=2100),
        anchor_month: int | None = Query(None, ge=1, le=12),
    ) -> MetricSnapshot | Response:
        if (date_from is None) ^ (date_to is None):
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'date_from and date_to must be provided together',
                'base_metrics_validation',
                request,
            )
        if date_from is not None and (year is not None or month is not None):
            raise http_error(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                'pass either date_from/date_to or year/month, not both',
                'base_metrics_validation',
                request,
            )
        _validate_base_pair(base_from, base_to)
        earliest, latest = data_bounds(db, restaurant.id)
        try:
            resolved_from, resolved_to, _, _ = resolve_period(
                db,
                restaurant.id,
                year=year,
                month=month,
                date_from=date_from,
                date_to=date_to,
                earliest=earliest,
                latest=latest,
            )
            assert_fact_span(resolved_from, resolved_to)
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

        etag = _etag(restaurant.id, earliest, latest)
        snap_etag = (
            f'{etag}:{mode.value}:{resolved_from}:{resolved_to}:'
            f'{base_from}:{base_to}:{week_start}:{week_end}:{year}:{month}'
        )
        if cached := _not_modified(request, snap_etag):
            return cached
        _apply_cache(response, snap_etag)
        try:
            return metric_snapshot(
                db,
                restaurant.id,
                resolved_from,
                resolved_to,
                mode=mode,
                base_from=base_from,
                base_to=base_to,
                week_start=week_start,
                week_end=week_end,
                anchor_year=anchor_year or year,
                anchor_month=anchor_month or month,
                earliest=earliest,
                latest=latest,
            )
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    @router.get(
        '/batch',
        response_model=MetricBatch,
        operation_id='getBaseMetricsBatch',
        summary='Несколько метрик за один запрос',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(_HEAVY_LIMIT)
    def get_batch(
        request: Request,
        response: Response,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        metrics: str = Query(
            ...,
            description='CSV имён: revenue,checks,guests,avg-check (≤10)',
            examples=['revenue,checks,avg-check'],
        ),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
        include_compare: bool = Query(False),
        base_from: date | None = Query(None),
        base_to: date | None = Query(None),
    ) -> MetricBatch | Response:
        _validate_ordered(date_from, date_to)
        _validate_base_pair(base_from, base_to)
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        names = _parse_metrics(None, metrics)
        try:
            return metric_batch(
                db,
                restaurant.id,
                names,
                date_from,
                date_to,
                include_compare=include_compare,
                base_from=base_from,
                base_to=base_to,
                earliest=earliest,
            )
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    @router.get(
        '/units',
        response_model=UnitsResponse,
        operation_id='getBaseMetricsUnits',
        summary='Выручка и себестоимость по юнитам k/b/w/o',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(_HEAVY_LIMIT)
    def get_units(
        request: Request,
        response: Response,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
        include_compare: bool = Query(True),
        base_from: date | None = Query(None),
        base_to: date | None = Query(None),
    ) -> UnitsResponse | Response:
        _validate_ordered(date_from, date_to)
        _validate_base_pair(base_from, base_to)
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        try:
            return metric_units(
                db,
                restaurant.id,
                date_from,
                date_to,
                include_compare=include_compare,
                base_from=base_from,
                base_to=base_to,
            )
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    def _run_compare(
        *,
        request: Request,
        response: Response,
        metric: MetricName,
        restaurant,
        db: Session,
        date_from: date,
        date_to: date,
        base_from: date | None,
        base_to: date | None,
    ) -> MetricCompare | Response:
        _validate_ordered(date_from, date_to)
        _validate_base_pair(base_from, base_to)
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        try:
            return metric_compare(
                db,
                restaurant.id,
                metric,
                date_from,
                date_to,
                base_from=base_from,
                base_to=base_to,
                earliest=earliest,
            )
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    @router.get(
        '/{metric}',
        response_model=MetricFact,
        operation_id='getBaseMetricFact',
        summary='Факт метрики за период',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(light)
    def get_metric_fact(
        request: Request,
        response: Response,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
    ) -> MetricFact | Response:
        _validate_ordered(date_from, date_to)
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        try:
            return metric_fact(db, restaurant.id, metric, date_from, date_to)
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    @router.get(
        '/{metric}/compare',
        response_model=MetricCompare,
        operation_id='getBaseMetricCompare',
        summary='Метрика против базового периода',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(light)
    def get_metric_compare(
        request: Request,
        response: Response,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
        base_from: date | None = Query(None),
        base_to: date | None = Query(None),
    ) -> MetricCompare | Response:
        return _run_compare(
            request=request,
            response=response,
            metric=metric,
            restaurant=restaurant,
            db=db,
            date_from=date_from,
            date_to=date_to,
            base_from=base_from,
            base_to=base_to,
        )

    @router.get(
        '/{metric}/series',
        response_model=MetricSeries,
        operation_id='getBaseMetricSeries',
        summary='Ряд метрики (график)',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(_HEAVY_LIMIT)
    def get_metric_series(
        request: Request,
        response: Response,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
        granularity: SeriesGranularity = Query(SeriesGranularity.day),
    ) -> MetricSeries | Response:
        _validate_series_span(date_from, date_to, granularity)
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        try:
            return metric_series(
                db,
                restaurant.id,
                metric,
                date_from,
                date_to,
                granularity=granularity,
            )
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    @router.get(
        '/{metric}/forecast',
        response_model=MetricForecast,
        operation_id='getBaseMetricForecast',
        summary='Прогноз метрики (weekday model)',
        responses=_OPENAPI_AUTH,
    )
    @limiter.limit(_HEAVY_LIMIT)
    def get_metric_forecast(
        request: Request,
        response: Response,
        metric: MetricName,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
        year_mode: bool = Query(False),
    ) -> MetricForecast | Response:
        _validate_ordered(date_from, date_to)
        earliest, latest = data_bounds(db, restaurant.id)
        etag = _etag(restaurant.id, earliest, latest)
        if cached := _not_modified(request, etag):
            return cached
        _apply_cache(response, etag)
        try:
            return metric_forecast(
                db,
                restaurant.id,
                metric,
                date_from,
                date_to,
                year_mode=year_mode,
            )
        except ValueError as exc:
            raise _domain_http(exc, request=request) from exc

    return router
