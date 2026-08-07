"""Контракт REST /api/base-metrics/*.

Сырые факты; % и форматирование — на клиенте.
Даты не усекаются (в отличие от /api/sales). Avg при нулевом знаменателе → null.
Деньги считаются в Decimal и в JSON отдаются как число с квантом 0.0001.
"""

from __future__ import annotations

from datetime import date as Date
from enum import Enum
from typing import Literal

from pydantic import ConfigDict, Field, model_validator

from src.schemas.base import StrictModel
from src.services.analytics.pace import PACE_RISK_RATIO


class MetricName(str, Enum):
    revenue = 'revenue'
    checks = 'checks'
    guests = 'guests'
    avg_check = 'avg-check'
    avg_check_per_guest = 'avg-check-per-guest'


class SeriesGranularity(str, Enum):
    day = 'day'
    month = 'month'


class MetricUnit(str, Enum):
    money = 'money'
    count = 'count'
    ratio = 'ratio'


class SnapshotMode(str, Enum):
    full = 'full'
    chart = 'chart'
    kpi = 'kpi'


METRIC_UNIT: dict[MetricName, MetricUnit] = {
    MetricName.revenue: MetricUnit.money,
    MetricName.checks: MetricUnit.count,
    MetricName.guests: MetricUnit.count,
    MetricName.avg_check: MetricUnit.ratio,
    MetricName.avg_check_per_guest: MetricUnit.ratio,
}


class MetricBounds(StrictModel):
    date_from: Date | None = Field(description='Первый день с заказами; null — пусто')
    date_to: Date | None = Field(
        description='Последний день с заказами в БД; null — пусто',
    )


class DefaultPeriod(StrictModel):
    date_from: Date
    date_to: Date
    mode: Literal['month'] = 'month'
    bounds: MetricBounds


class MetricFact(StrictModel):
    metric: MetricName
    unit: MetricUnit
    date_from: Date
    date_to: Date
    value: float | int | None = Field(
        description=(
            'Суммы/счётчики: 0 = нет продаж. '
            'Дроби (avg-*): null = делить не на что. '
            'Деньги — квант 0.0001 без серверного round()'
        ),
    )

    @model_validator(mode='after')
    def _ordered_dates(self) -> MetricFact:
        if self.date_from > self.date_to:
            raise ValueError('date_from must be on or before date_to')
        return self


class MetricCompare(MetricFact):
    base_date_from: Date
    base_date_to: Date
    base_value: float | int | None
    base_incomplete: bool = Field(
        description='True, если база раньше начала истории или данных нет',
    )


class SeriesPoint(StrictModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True, ser_json_by_alias=True)

    day: Date = Field(
        validation_alias='date',
        serialization_alias='date',
        description='Календарный день или 1-е число месяца',
    )
    value: float | int | None


class MetricSeries(StrictModel):
    metric: MetricName
    unit: MetricUnit
    date_from: Date
    date_to: Date
    granularity: SeriesGranularity = SeriesGranularity.day
    points: list[SeriesPoint]


class MetricBatchItem(StrictModel):
    metric: MetricName
    unit: MetricUnit
    date_from: Date
    date_to: Date
    value: float | int | None
    base_date_from: Date | None = None
    base_date_to: Date | None = None
    base_value: float | int | None = None
    base_incomplete: bool | None = None


class MetricBatch(StrictModel):
    items: list[MetricBatchItem]


class UnitSums(StrictModel):
    key: Literal['k', 'b', 'w', 'o']
    revenue: float
    cost: float
    prev_revenue: float | None = None
    prev_cost: float | None = None


class UnitsResponse(StrictModel):
    date_from: Date
    date_to: Date
    base_date_from: Date | None = None
    base_date_to: Date | None = None
    units: list[UnitSums]


class ForecastPoint(StrictModel):
    model_config = ConfigDict(extra='forbid', populate_by_name=True, ser_json_by_alias=True)

    day: Date = Field(validation_alias='date', serialization_alias='date')
    value: float | None


class MetricForecast(StrictModel):
    metric: Literal['revenue', 'checks', 'guests']
    date_from: Date
    date_to: Date
    horizon_end: Date
    ready: bool
    forecast: float | None
    forecast_today: float | None
    pace_risk: bool = Field(
        False,
        description='fact < forecast_today * pace_risk_ratio (канон attention/KPI)',
    )
    pace_risk_ratio: float = Field(
        default=PACE_RISK_RATIO,
        description='Порог из analytics.pace — единый с attention',
    )
    points: list[ForecastPoint]


class MetricSnapshot(StrictModel):
    """Один ответ для сборки дашборда: bounds + KPI + units + series + forecast."""

    mode: SnapshotMode
    bounds: MetricBounds
    date_from: Date
    date_to: Date
    compare_date_from: Date
    compare_date_to: Date
    batch: MetricBatch
    units: UnitsResponse
    day_series: list[MetricSeries] = Field(default_factory=list)
    month_series: list[MetricSeries] = Field(default_factory=list)
    forecasts: list[MetricForecast] = Field(default_factory=list)
    week_start: Date | None = None
    week_end: Date | None = None
    week_batch: MetricBatch | None = None
    week_units: UnitsResponse | None = None
    week_day_series: list[MetricSeries] = Field(default_factory=list)
    month_revenue: float | None = None
