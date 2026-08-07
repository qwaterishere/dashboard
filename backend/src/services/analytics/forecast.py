"""Прогноз по дням недели (без плана — план в /api/targets).

Не больше 2 чтений period_daily: период + история.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from src.services.analytics.money import money_float
from src.services.analytics.pace import PACE_RISK_RATIO, is_pace_risk
from src.services.analytics.queries import period_daily

FORECAST_MIN_DAYS = 7
HISTORY_WEEKS = 8
FORECAST_METRICS = frozenset({'revenue', 'checks', 'guests'})


def _worked_by_weekday(
    daily: dict[date, dict],
    metric: str,
    d_from: date,
    d_to: date,
) -> dict[int, list[float]]:
    by_weekday: dict[int, list[float]] = {i: [] for i in range(7)}
    day = d_from
    while day <= d_to:
        raw = daily.get(day, {}).get(metric, 0) or 0
        value = float(raw) if not isinstance(raw, Decimal) else money_float(raw)
        if value > 0:
            by_weekday[day.weekday()].append(value)
        day += timedelta(days=1)
    return by_weekday


def _weekday_mean(
    current: dict[int, list[float]],
    historic: dict[int, list[float]],
    weekday: int,
) -> float:
    values = current[weekday] or historic[weekday]
    return sum(values) / len(values) if values else 0.0


@dataclass(frozen=True)
class ForecastContext:
    current: dict[int, list[float]]
    historic: dict[int, list[float]]
    ready: bool


def forecast_horizon(d_from: date, *, year_mode: bool) -> date:
    if year_mode:
        return date(d_from.year, 12, 31)
    last = calendar.monthrange(d_from.year, d_from.month)[1]
    return date(d_from.year, d_from.month, last)


def build_forecast_from_daily(
    metric: str,
    d_from: date,
    d_to: date,
    daily: dict[date, dict],
    history: dict[date, dict],
    hist_from: date,
    hist_to: date,
    *,
    year_mode: bool = False,
) -> dict:
    """Сборка прогноза без дополнительных SQL — daily/history уже загружены."""
    if metric not in FORECAST_METRICS:
        raise ValueError('forecast supports revenue|checks|guests only')

    horizon_end = forecast_horizon(d_from, year_mode=year_mode)
    elapsed = (d_to - d_from).days + 1
    if elapsed < FORECAST_MIN_DAYS:
        return {
            'metric': metric,
            'date_from': d_from,
            'date_to': d_to,
            'horizon_end': horizon_end,
            'ready': False,
            'forecast': None,
            'forecast_today': None,
            'pace_risk': False,
            'pace_risk_ratio': PACE_RISK_RATIO,
            'points': [],
        }

    ctx = ForecastContext(
        current=_worked_by_weekday(daily, metric, d_from, d_to),
        historic=_worked_by_weekday(history, metric, hist_from, hist_to),
        ready=True,
    )

    fact = 0.0
    day = d_from
    while day <= d_to:
        raw = daily.get(day, {}).get(metric, 0) or 0
        fact += float(raw) if not isinstance(raw, Decimal) else money_float(raw)
        day += timedelta(days=1)

    projected = 0.0
    day = d_to + timedelta(days=1)
    while day <= horizon_end:
        projected += _weekday_mean(ctx.current, ctx.historic, day.weekday())
        day += timedelta(days=1)

    pace: float | None = None
    if d_to < horizon_end:
        pace = 0.0
        day = d_from
        while day <= d_to:
            pace += _weekday_mean(ctx.current, ctx.historic, day.weekday())
            day += timedelta(days=1)

    points = []
    day = d_from
    while day <= horizon_end:
        expected = _weekday_mean(ctx.current, ctx.historic, day.weekday())
        points.append({
            'date': day,
            'value': expected if expected > 0 else None,
        })
        day += timedelta(days=1)

    return {
        'metric': metric,
        'date_from': d_from,
        'date_to': d_to,
        'horizon_end': horizon_end,
        'ready': True,
        'forecast': fact + projected,
        'forecast_today': pace,
        'pace_risk': is_pace_risk(fact, pace),
        'pace_risk_ratio': PACE_RISK_RATIO,
        'points': points,
    }


def build_metric_forecast(
    session: Session,
    restaurant_id: UUID,
    metric: str,
    d_from: date,
    d_to: date,
    *,
    year_mode: bool = False,
    daily: dict[date, dict] | None = None,
    history: dict[date, dict] | None = None,
) -> dict:
    """≤2 SQL: daily периода + daily истории (можно передать готовые)."""
    if metric not in FORECAST_METRICS:
        raise ValueError('forecast supports revenue|checks|guests only')

    hist_from = d_from - timedelta(weeks=HISTORY_WEEKS)
    hist_to = d_from - timedelta(days=1)

    if daily is None:
        daily = period_daily(session, restaurant_id, d_from, d_to)
    if history is None and (d_to - d_from).days + 1 >= FORECAST_MIN_DAYS:
        history = period_daily(session, restaurant_id, hist_from, hist_to)
    if history is None:
        history = {}

    return build_forecast_from_daily(
        metric, d_from, d_to, daily, history, hist_from, hist_to,
        year_mode=year_mode,
    )


def build_forecasts_bundle(
    session: Session,
    restaurant_id: UUID,
    metrics: list[str],
    d_from: date,
    d_to: date,
    *,
    year_mode: bool = False,
    daily: dict[date, dict] | None = None,
) -> dict[str, dict]:
    """Все прогнозы за 0–2 SQL (общие daily + history)."""
    hist_from = d_from - timedelta(weeks=HISTORY_WEEKS)
    hist_to = d_from - timedelta(days=1)
    if daily is None:
        daily = period_daily(session, restaurant_id, d_from, d_to)
    history: dict[date, dict] = {}
    if (d_to - d_from).days + 1 >= FORECAST_MIN_DAYS:
        history = period_daily(session, restaurant_id, hist_from, hist_to)

    return {
        m: build_forecast_from_daily(
            m, d_from, d_to, daily, history, hist_from, hist_to,
            year_mode=year_mode,
        )
        for m in metrics
        if m in FORECAST_METRICS
    }
