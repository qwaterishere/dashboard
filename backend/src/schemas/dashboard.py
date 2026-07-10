"""Контракт страницы «Дашборд» — docs/frontend-handoff.md §1."""

from typing import Literal

from pydantic import Field

from .base import StrictModel, Period


class KpiMetric(StrictModel):
    """Метрика KPI-карточки. LfL-процент и стрелку фронт считает сам:
    (value - prevValue) / prevValue."""

    value: float = Field(description="Значение за текущий период")
    prevValue: float | None = Field(
        description="Значение за период compare (тот же прошлого года); "
        "null — сравнивать не с чем (нет прошлого года)"
    )
    forecast: float | None = Field(
        description="Run-rate-прогноз на конец месяца по средним дням недели; "
        "null — прогноз не готов (< 7 закрытых дней)"
    )


class RevenueDay(StrictModel):
    """Один день графика. Отдаётся полный календарь периода:
    закрытые дни заведения присутствуют с нулями."""

    day: int = Field(description="Число месяца 1..31")
    weekday: int = Field(
        description="День недели: 0=вс..6=сб (совместим с palette.WEEKDAYS_SHORT)"
    )
    revenue: float = Field(description="Фактическая выручка дня (со скидками)")
    checks: int = Field(description="Закрытых чеков за день")
    guests: int = Field(description="Гостей за день (как ввёл персонал)")
    plan: float | None = Field(
        description="План дня; null — планы не внесены (до модуля targets)"
    )


class UnitSums(StrictModel):
    """Суммы по подразделению. Доли, фудкост-проценты и дельты —
    производные на фронте: доля = revenue / сумма revenue k+b+w
    ('o' в донат не входит); фудкост = cost / revenue."""

    key: Literal["k", "b", "w", "o"] = Field(
        description="Юнит: k кухня, b бар, w вино, o «вне подразделений» "
        "(группы iiko вне папок Кухня/Бар/Вино)"
    )
    revenue: float = Field(description="Выручка юнита за period")
    cost: float = Field(description="Себестоимость продаж юнита за period")
    prevRevenue: float = Field(description="Выручка юнита за compare")
    prevCost: float = Field(description="Себестоимость юнита за compare")


class Kpis(StrictModel):
    revenue: KpiMetric = Field(description="Выручка (paid_sum — со скидками)")
    checks: KpiMetric = Field(description="Закрытые чеки")
    guests: KpiMetric = Field(description="Гости (по вводу персонала)")
    avgCheck: KpiMetric = Field(
        description="Средний чек = выручка/чеки; прогнозный = "
        "forecast выручки / forecast чеков"
    )


class Dashboard(StrictModel):
    period: Period = Field(
        description="Показываемый период: месяц последнего закрытого дня"
    )
    compare: Period = Field(
        description="Период сравнения: те же числа прошлого года (29.02 -> 28.02)"
    )
    kpis: Kpis
    revenueByDay: list[RevenueDay] = Field(
        description="Полный календарь периода, закрытые дни — нулями"
    )
    units: list[UnitSums] = Field(
        description="Всегда четыре элемента: k, b, w, o (нулевые включены)"
    )
    reviews: None = None
    stock: None = None
