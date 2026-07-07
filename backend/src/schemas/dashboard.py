"""Контракт v2 страницы «Дашборд» — docs/frontend-handoff.md §1."""

from typing import Literal

from pydantic import Field

from src.schemas.base import StrictModel


class PeriodV2(StrictModel):
    year: int = Field(description="Год, например 2026")
    month: int = Field(description="Месяц 1..12")
    dayFrom: int = Field(description="Первое число периода (обычно 1)")
    dayTo: int = Field(description="Последний закрытый день периода")


class KpiMetric(StrictModel):
    value: float = Field(description="Значение за период period")
    prev: float | None = Field(
        description="Значение за период compare; null — сравнивать не с чем"
    )
    forecast: float | None = Field(
        description="Run-rate-прогноз на конец месяца; null — < 7 закрытых дней"
    )


class RevenueDayV2(StrictModel):
    day: int = Field(description="Число месяца 1..31")
    weekday: int = Field(description="День недели: 0=вс..6=сб")
    revenue: float = Field(description="Фактическая выручка дня")
    checks: int = Field(description="Закрытых чеков за день")
    guests: int = Field(description="Гостей за день")
    plan: float | None = Field(description="План дня; null — планы не внесены")


class UnitSums(StrictModel):
    key: Literal["k", "b", "w", "o"] = Field(
        description="Юнит: k кухня, b бар, w вино, o вне подразделений"
    )
    revenue: float
    cost: float
    prevRevenue: float
    prevCost: float


class Kpis(StrictModel):
    revenue: KpiMetric
    checks: KpiMetric
    guests: KpiMetric
    avgCheck: KpiMetric


class DashboardV2(StrictModel):
    period: PeriodV2
    compare: PeriodV2
    kpis: Kpis
    revenueByDay: list[RevenueDayV2]
    units: list[UnitSums]
    reviews: None = None
    stock: None = None
