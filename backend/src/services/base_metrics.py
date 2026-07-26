"""Сервис /api/base-metrics/* — факты поверх analytics.queries."""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from src.schemas.base_metrics import (
    METRIC_UNIT,
    DefaultPeriod,
    MetricBatch,
    MetricBatchItem,
    MetricBounds,
    MetricCompare,
    MetricFact,
    MetricForecast,
    MetricName,
    MetricSeries,
    MetricSnapshot,
    SeriesGranularity,
    SeriesPoint,
    SnapshotMode,
    UnitSums,
    UnitsResponse,
)
from src.services.analytics import forecast as forecast_svc
from src.services.analytics.money import money_float, ratio_float
from src.services.analytics.queries import (
    UNIT_KEYS,
    data_bounds,
    default_month_period,
    period_daily,
    period_monthly,
    period_totals,
    resolve_period,
    unit_sums,
)
from src.services.analytics.period_compare import previous_period

_RATIO: dict[MetricName, tuple[str, str]] = {
    MetricName.avg_check: ('revenue', 'checks'),
    MetricName.avg_check_per_guest: ('revenue', 'guests'),
}

_BASE = frozenset({MetricName.revenue, MetricName.checks, MetricName.guests})
_SERIES_METRICS = (MetricName.revenue, MetricName.checks, MetricName.guests)
_FORECAST_METRICS = ('revenue', 'checks', 'guests')

# Anti-abuse: fact/compare/batch/units/snapshot (не series — у series свои лимиты).
MAX_FACT_DAYS = 366 * 5


def _as_name(metric: MetricName | str) -> MetricName:
    if isinstance(metric, MetricName):
        return metric
    try:
        return MetricName(metric)
    except ValueError as exc:
        raise ValueError(f'unknown metric: {metric}') from exc


def _wire_value(
    metric: MetricName, totals: dict[str, Decimal | int],
) -> float | int | None:
    if metric in _RATIO:
        num_key, den_key = _RATIO[metric]
        return ratio_float(totals[num_key], int(totals[den_key]))  # type: ignore[arg-type]
    if metric not in _BASE:
        raise ValueError(f'unknown metric: {metric}')
    raw = totals[metric.value]
    if metric in (MetricName.checks, MetricName.guests):
        return int(raw)
    return money_float(raw)  # type: ignore[arg-type]


def _base_incomplete(
    base_from: date, base_to: date, earliest: date | None,
) -> bool:
    if earliest is None:
        return True
    return base_from < earliest


def _resolve_base(
    d_from: date,
    d_to: date,
    base_from: date | None,
    base_to: date | None,
) -> tuple[date, date]:
    if (base_from is None) ^ (base_to is None):
        raise ValueError('base_from and base_to must be provided together')
    if base_from is None:
        return previous_period(d_from, d_to)
    return base_from, base_to


def assert_fact_span(d_from: date, d_to: date) -> None:
    span = (d_to - d_from).days + 1
    if span > MAX_FACT_DAYS:
        raise ValueError(f'period is limited to {MAX_FACT_DAYS} days')


def metric_bounds(
    session: Session,
    restaurant_id: UUID,
    *,
    earliest: date | None | object = ...,
    latest: date | None | object = ...,
) -> MetricBounds:
    if earliest is ... or latest is ...:
        earliest, latest = data_bounds(session, restaurant_id)
    return MetricBounds(date_from=earliest, date_to=latest)  # type: ignore[arg-type]


def metric_default_period(
    session: Session, restaurant_id: UUID,
) -> DefaultPeriod:
    d_from, d_to, earliest, latest = default_month_period(session, restaurant_id)
    return DefaultPeriod(
        date_from=d_from,
        date_to=d_to,
        bounds=MetricBounds(date_from=earliest, date_to=latest),
    )


def metric_fact(
    session: Session,
    restaurant_id: UUID,
    metric: MetricName | str,
    d_from: date,
    d_to: date,
) -> MetricFact:
    assert_fact_span(d_from, d_to)
    name = _as_name(metric)
    totals = period_totals(session, restaurant_id, d_from, d_to)
    return MetricFact(
        metric=name,
        unit=METRIC_UNIT[name],
        date_from=d_from,
        date_to=d_to,
        value=_wire_value(name, totals),
    )


def metric_compare(
    session: Session,
    restaurant_id: UUID,
    metric: MetricName | str,
    d_from: date,
    d_to: date,
    *,
    base_from: date | None = None,
    base_to: date | None = None,
    earliest: date | None | object = ...,
) -> MetricCompare:
    assert_fact_span(d_from, d_to)
    name = _as_name(metric)
    resolved_from, resolved_to = _resolve_base(d_from, d_to, base_from, base_to)
    assert_fact_span(resolved_from, resolved_to)
    totals = period_totals(session, restaurant_id, d_from, d_to)
    base_totals = period_totals(session, restaurant_id, resolved_from, resolved_to)
    if earliest is ...:
        earliest, _ = data_bounds(session, restaurant_id)
    return MetricCompare(
        metric=name,
        unit=METRIC_UNIT[name],
        date_from=d_from,
        date_to=d_to,
        value=_wire_value(name, totals),
        base_date_from=resolved_from,
        base_date_to=resolved_to,
        base_value=_wire_value(name, base_totals),
        base_incomplete=_base_incomplete(resolved_from, resolved_to, earliest),  # type: ignore[arg-type]
    )


def _point(day: date, value: float | int | None) -> SeriesPoint:
    return SeriesPoint.model_validate({'date': day, 'value': value})


def _series_from_bucket(
    name: MetricName,
    d_from: date,
    d_to: date,
    bucket: dict[date, dict],
    *,
    granularity: SeriesGranularity,
    fill_days: bool,
) -> MetricSeries:
    points: list[SeriesPoint] = []
    if fill_days and granularity == SeriesGranularity.day:
        day = d_from
        while day <= d_to:
            row = bucket.get(day)
            if name in _RATIO:
                if not row:
                    points.append(_point(day, None))
                else:
                    points.append(_point(day, _wire_value(name, row)))  # type: ignore[arg-type]
            else:
                value: float | int = 0
                if row:
                    raw = row[name.value]
                    value = int(raw) if name in (MetricName.checks, MetricName.guests) else money_float(raw)  # type: ignore[arg-type]
                points.append(_point(day, value))
            day += timedelta(days=1)
    else:
        # month: dense calendar months
        cursor = date(d_from.year, d_from.month, 1)
        end_month = date(d_to.year, d_to.month, 1)
        while cursor <= end_month:
            row = bucket.get(cursor)
            if name in _RATIO:
                points.append(_point(cursor, _wire_value(name, row) if row else None))  # type: ignore[arg-type]
            else:
                value = 0
                if row:
                    raw = row[name.value]
                    value = int(raw) if name in (MetricName.checks, MetricName.guests) else money_float(raw)  # type: ignore[arg-type]
                points.append(_point(cursor, value))
            if cursor.month == 12:
                cursor = date(cursor.year + 1, 1, 1)
            else:
                cursor = date(cursor.year, cursor.month + 1, 1)

    return MetricSeries(
        metric=name,
        unit=METRIC_UNIT[name],
        date_from=d_from,
        date_to=d_to,
        granularity=granularity,
        points=points,
    )


def metric_series(
    session: Session,
    restaurant_id: UUID,
    metric: MetricName | str,
    d_from: date,
    d_to: date,
    *,
    granularity: SeriesGranularity | str = SeriesGranularity.day,
) -> MetricSeries:
    name = _as_name(metric)
    gran = (
        granularity if isinstance(granularity, SeriesGranularity)
        else SeriesGranularity(granularity)
    )
    if gran == SeriesGranularity.month:
        bucket = period_monthly(session, restaurant_id, d_from, d_to)
        return _series_from_bucket(
            name, d_from, d_to, bucket,
            granularity=SeriesGranularity.month, fill_days=False,
        )
    daily = period_daily(session, restaurant_id, d_from, d_to)
    return _series_from_bucket(
        name, d_from, d_to, daily,
        granularity=SeriesGranularity.day, fill_days=True,
    )


def metric_batch(
    session: Session,
    restaurant_id: UUID,
    metrics: list[MetricName | str],
    d_from: date,
    d_to: date,
    *,
    include_compare: bool = False,
    base_from: date | None = None,
    base_to: date | None = None,
    earliest: date | None | object = ...,
) -> MetricBatch:
    assert_fact_span(d_from, d_to)
    if not metrics:
        raise ValueError('metrics must list at least one name')
    if len(metrics) > 10:
        raise ValueError('metrics is limited to 10 names')

    names = [_as_name(m) for m in metrics]
    totals = period_totals(session, restaurant_id, d_from, d_to)
    base_totals = None
    resolved: tuple[date, date] | None = None
    incomplete: bool | None = None

    if include_compare:
        resolved = _resolve_base(d_from, d_to, base_from, base_to)
        assert_fact_span(resolved[0], resolved[1])
        base_totals = period_totals(session, restaurant_id, resolved[0], resolved[1])
        if earliest is ...:
            earliest, _ = data_bounds(session, restaurant_id)
        incomplete = _base_incomplete(resolved[0], resolved[1], earliest)  # type: ignore[arg-type]

    items: list[MetricBatchItem] = []
    for name in names:
        item = MetricBatchItem(
            metric=name,
            unit=METRIC_UNIT[name],
            date_from=d_from,
            date_to=d_to,
            value=_wire_value(name, totals),
        )
        if include_compare and resolved is not None and base_totals is not None:
            item = item.model_copy(update={
                'base_date_from': resolved[0],
                'base_date_to': resolved[1],
                'base_value': _wire_value(name, base_totals),
                'base_incomplete': incomplete,
            })
        items.append(item)
    return MetricBatch(items=items)


def metric_units(
    session: Session,
    restaurant_id: UUID,
    d_from: date,
    d_to: date,
    *,
    include_compare: bool = True,
    base_from: date | None = None,
    base_to: date | None = None,
) -> UnitsResponse:
    assert_fact_span(d_from, d_to)
    cur = unit_sums(session, restaurant_id, d_from, d_to)
    prev = None
    resolved: tuple[date, date] | None = None
    if include_compare:
        resolved = _resolve_base(d_from, d_to, base_from, base_to)
        assert_fact_span(resolved[0], resolved[1])
        prev = unit_sums(session, restaurant_id, resolved[0], resolved[1])

    units = [
        UnitSums(
            key=key,  # type: ignore[arg-type]
            revenue=money_float(cur[key]['revenue']),
            cost=money_float(cur[key]['cost']),
            prev_revenue=money_float(prev[key]['revenue']) if prev else None,
            prev_cost=money_float(prev[key]['cost']) if prev else None,
        )
        for key in UNIT_KEYS
    ]
    return UnitsResponse(
        date_from=d_from,
        date_to=d_to,
        base_date_from=resolved[0] if resolved else None,
        base_date_to=resolved[1] if resolved else None,
        units=units,
    )


def metric_forecast(
    session: Session,
    restaurant_id: UUID,
    metric: MetricName | str,
    d_from: date,
    d_to: date,
    *,
    year_mode: bool = False,
) -> MetricForecast:
    assert_fact_span(d_from, d_to)
    name = _as_name(metric)
    if name.value not in forecast_svc.FORECAST_METRICS:
        raise ValueError('forecast supports revenue|checks|guests only')
    payload = forecast_svc.build_metric_forecast(
        session, restaurant_id, name.value, d_from, d_to, year_mode=year_mode,
    )
    return MetricForecast.model_validate(payload)


def _ytd_from(d_to: date) -> date:
    return date(d_to.year, 1, 1)


def metric_snapshot(
    session: Session,
    restaurant_id: UUID,
    d_from: date | None = None,
    d_to: date | None = None,
    *,
    mode: SnapshotMode | str = SnapshotMode.full,
    year: int | None = None,
    month: int | None = None,
    base_from: date | None = None,
    base_to: date | None = None,
    week_start: date | None = None,
    week_end: date | None = None,
    anchor_year: int | None = None,
    anchor_month: int | None = None,
    earliest: date | None | object = ...,
    latest: date | None | object = ...,
) -> MetricSnapshot:
    """Снимок для дашборда за один HTTP.

    Период: явные date_from/date_to, либо year/month, либо месяц последних данных.
    Бюджет SQL (full, без week, даты уже известны): ≤12
      2+2 totals + 1+1 units + 2 daily + 2 monthly + 2 forecast history.
    Один data_bounds сверху (если не передан). Week overlay ≈ +7.
    """
    snap_mode = mode if isinstance(mode, SnapshotMode) else SnapshotMode(mode)
    if (week_start is None) ^ (week_end is None):
        raise ValueError('week_start and week_end must be provided together')

    d_from, d_to, earliest, latest = resolve_period(
        session,
        restaurant_id,
        year=year,
        month=month,
        date_from=d_from,
        date_to=d_to,
        earliest=earliest,
        latest=latest,
    )
    assert_fact_span(d_from, d_to)
    compare_from, compare_to = _resolve_base(d_from, d_to, base_from, base_to)
    assert_fact_span(compare_from, compare_to)

    need_kpi = snap_mode in (SnapshotMode.full, SnapshotMode.kpi)
    need_day = snap_mode in (SnapshotMode.full, SnapshotMode.chart) and d_from.month == d_to.month
    # year span still wants day series if same request covers days; for year mode FE uses month
    year_mode = d_from.month == 1 and d_from.day == 1 and (d_to - d_from).days > 40
    if year_mode:
        need_day = False
    need_month = snap_mode in (SnapshotMode.full, SnapshotMode.chart)
    need_forecast = need_kpi
    need_units = snap_mode in (SnapshotMode.full, SnapshotMode.chart) or week_start is not None

    batch_metrics = [
        MetricName.revenue, MetricName.checks, MetricName.guests, MetricName.avg_check,
    ]

    totals = period_totals(session, restaurant_id, d_from, d_to)
    base_totals = period_totals(session, restaurant_id, compare_from, compare_to)
    incomplete = _base_incomplete(compare_from, compare_to, earliest)

    batch_items = [
        MetricBatchItem(
            metric=name,
            unit=METRIC_UNIT[name],
            date_from=d_from,
            date_to=d_to,
            value=_wire_value(name, totals),
            base_date_from=compare_from,
            base_date_to=compare_to,
            base_value=_wire_value(name, base_totals),
            base_incomplete=incomplete,
        )
        for name in batch_metrics
    ]
    batch = MetricBatch(items=batch_items)

    units = metric_units(
        session, restaurant_id, d_from, d_to,
        include_compare=True, base_from=compare_from, base_to=compare_to,
    ) if need_units else UnitsResponse(
        date_from=d_from, date_to=d_to, units=[
            UnitSums(key=k, revenue=0.0, cost=0.0)  # type: ignore[arg-type]
            for k in UNIT_KEYS
        ],
    )

    daily: dict | None = None
    day_series: list[MetricSeries] = []
    if need_day or need_forecast:
        daily = period_daily(session, restaurant_id, d_from, d_to)
    if need_day and daily is not None:
        day_series = [
            _series_from_bucket(
                name, d_from, d_to, daily,
                granularity=SeriesGranularity.day, fill_days=True,
            )
            for name in _SERIES_METRICS
        ]

    month_series: list[MetricSeries] = []
    if need_month:
        ytd_from = _ytd_from(d_to)
        monthly = period_monthly(session, restaurant_id, ytd_from, d_to)
        month_series = [
            _series_from_bucket(
                name, ytd_from, d_to, monthly,
                granularity=SeriesGranularity.month, fill_days=False,
            )
            for name in _SERIES_METRICS
        ]

    forecasts: list[MetricForecast] = []
    if need_forecast:
        bundle = forecast_svc.build_forecasts_bundle(
            session, restaurant_id, list(_FORECAST_METRICS), d_from, d_to,
            year_mode=year_mode, daily=daily,
        )
        forecasts = [MetricForecast.model_validate(bundle[m]) for m in _FORECAST_METRICS]

    week_batch = None
    week_units = None
    week_day_series: list[MetricSeries] = []
    month_revenue: float | None = None

    if week_start is not None and week_end is not None:
        if (week_end - week_start).days + 1 != 7:
            raise ValueError('week range must span exactly 7 days')
        w_compare_from, w_compare_to = (
            (base_from, base_to) if base_from and base_to
            else previous_period(week_start, week_end)
        )
        assert w_compare_from is not None and w_compare_to is not None
        week_batch = metric_batch(
            session, restaurant_id, batch_metrics, week_start, week_end,
            include_compare=True, base_from=w_compare_from, base_to=w_compare_to,
            earliest=earliest,
        )
        week_units = metric_units(
            session, restaurant_id, week_start, week_end,
            include_compare=True, base_from=w_compare_from, base_to=w_compare_to,
        )
        week_daily = period_daily(session, restaurant_id, week_start, week_end)
        week_day_series = [
            _series_from_bucket(
                name, week_start, week_end, week_daily,
                granularity=SeriesGranularity.day, fill_days=True,
            )
            for name in _SERIES_METRICS
        ]
        ay = anchor_year or d_from.year
        am = anchor_month or d_from.month
        m_from = date(ay, am, 1)
        m_last = calendar.monthrange(ay, am)[1]
        m_to = date(ay, am, m_last)
        if latest is not None:
            m_to = min(m_to, latest)
            if m_to < m_from:
                m_to = m_from
        if m_from == d_from and m_to == d_to:
            month_revenue = money_float(totals['revenue'])  # type: ignore[arg-type]
        else:
            month_revenue = money_float(
                period_totals(session, restaurant_id, m_from, m_to)['revenue'],  # type: ignore[arg-type]
            )

    return MetricSnapshot(
        mode=snap_mode,
        bounds=MetricBounds(date_from=earliest, date_to=latest),
        date_from=d_from,
        date_to=d_to,
        compare_date_from=compare_from,
        compare_date_to=compare_to,
        batch=batch,
        units=units,
        day_series=day_series,
        month_series=month_series,
        forecasts=forecasts,
        week_start=week_start,
        week_end=week_end,
        week_batch=week_batch,
        week_units=week_units,
        week_day_series=week_day_series,
        month_revenue=month_revenue,
    )
