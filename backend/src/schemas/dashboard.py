"""Контракт страницы «Дашборд» — docs/frontend-handoff.md §1."""

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from .base import StrictModel, Period


class KpiMetric(StrictModel):
    """Метрика KPI-карточки. LfL-процент и стрелку фронт считает сам:
    (value - prevValue) / prevValue."""

    value: float = Field(description="Значение за текущий период")
    prevValue: float | None = Field(
        description="Значение за период compare (предыдущий период);"
        "null — сравнивать не с чем (нет данных в compare)"
    )
    forecast: float | None = Field(
        description="Run-rate-прогноз на конец месяца (month-mode) или года "
        "(year-mode, year без month) по средним дням недели; "
        "null — прогноз не готов (< 7 закрытых дней)"
    )
    forecastToday: float | None = Field(
        description="Ожидаемый накопленный объём к последнему дню датафрейма "
        "(pace-засечка); null — прогноз не готов ИЛИ период уже завершён "
        "(засечка только у незавершённых month/year)"
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
    forecast: float | None = Field(
        description="Ожидаемая выручка на конец дня (weekday-модель); "
        "null — прогноз не готов (< 7 закрытых дней периода)"
    )


class RevenueMonth(StrictModel):
    """Один месяц годового графика (YTD до последнего закрытого дня)."""

    month: int = Field(ge=1, le=12, description="Номер месяца 1..12")
    revenue: float = Field(description="Выручка за закрытые дни месяца")
    checks: int = Field(description="Чеки с выручкой за месяц")
    guests: int = Field(description="Гости за месяц")
    plan: float | None = Field(
        description="План месяца; null — планы не внесены (до модуля targets)"
    )
    forecast: float | None = Field(
        description="Сумма дневных прогнозов за календарный месяц; "
        "null — прогноз не готов (< 7 закрытых дней периода)"
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


class WeekDayStat(StrictModel):
    """Факт одного дня внутри выбранной недели."""

    statDate: date = Field(alias="date", description="Календарная дата ISO")
    weekday: int = Field(description="0=вс..6=сб")
    revenue: float = Field(description="Выручка дня")
    checks: int = Field(description="Чеки с выручкой за день")
    guests: int = Field(description="Гости за день")
    avgCheck: float = Field(description="Средний чек дня = revenue / checks")


class WeekKpiContext(StrictModel):
    """Производные метрики недельного датафрейма (WoW + средний день)."""

    weekStart: date = Field(description="Первый день выбранной недели")
    weekEnd: date = Field(description="Последний день выбранной недели")
    prevWeekStart: date = Field(description="Первый день предыдущей недели")
    prevWeekEnd: date = Field(description="Последний день предыдущей недели")
    comparison: Literal["lfl"] = Field(
        description="Тип сравнения KPI: like-for-like с предыдущим периодом",
    )
    workingDays: int = Field(description="Дней с продажами в выбранной неделе")
    avgDailyRevenue: float = Field(description="Средняя выручка за календарный день недели")
    avgDailyChecks: float = Field(description="Среднее число чеков за календарный день недели")
    avgDailyGuests: float = Field(description="Среднее число гостей за календарный день недели")
    avgCheckMin: float = Field(description="Минимальный средний чек среди дней с продажами")
    avgCheckMax: float = Field(description="Максимальный средний чек среди дней с продажами")
    peakDay: WeekDayStat | None = Field(description="День с максимальной выручкой")
    weakDay: WeekDayStat | None = Field(description="День с минимальной выручкой среди рабочих")
    monthRevenueSharePct: float | None = Field(
        description="Доля выручки недели в выручке anchor-месяца (year+month query); null — месяц пуст"
    )


class DataBounds(StrictModel):
    earliest: date | None = Field(
        description="Первый день с данными в БД; null — база пустая",
    )
    latest: date | None = Field(
        description="Последний закрытый день с данными; null — база пустая",
    )


DataFreshnessStatus = Literal[
    "fresh",
    "stale",
    "stale_manual",
    "syncing",
    "error",
    "empty",
    "unconfigured",
]

SyncStatus = Literal["idle", "running", "success", "error", "noop"]


class DataFreshness(StrictModel):
    """Актуальность продаж в БД относительно закрытого дня (TZ ресторана)."""

    status: DataFreshnessStatus
    expectedDay: date = Field(description="Ожидаемый последний закрытый день (вчера в TZ)")
    latestSalesDay: date | None = Field(
        description="Фактический последний день с продажами в БД",
    )
    lagDays: int | None = Field(
        description="Отставание в календарных днях; null — нет данных",
    )
    lastSyncAt: datetime | None = Field(description="Завершение последней синхронизации iiko")
    syncStatus: SyncStatus = Field(description="Текущий статус sync job")
    syncError: str | None = Field(description="Сообщение об ошибке sync; null — нет ошибки")
    autoSyncEnabled: bool = Field(
        description="Автосинхронизация включена и iiko настроен",
    )
    syncProgressPercent: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Прогресс текущей синхронизации; null — sync не идёт",
    )


class DashboardKpi(StrictModel):
    """Лёгкий контракт GET /api/dashboard/kpi — только KPI-слой (LfL overlay)."""

    period: Period = Field(description="Период датафрейма (month anchor в week-mode)")
    compare: Period = Field(description="Период сравнения LfL")
    kpis: Kpis
    weekKpi: WeekKpiContext | None = Field(
        default=None,
        description="Контекст недельного датафрейма; null — month/year mode",
    )


class DashboardChart(StrictModel):
    """Лёгкий контракт GET /api/dashboard/chart — график и юниты без KPI/прогноза."""

    period: Period = Field(
        description="Показываемый период: месяц последнего закрытого дня",
    )
    compare: Period = Field(
        description="Период сравнения по умолчанию (LfL prev period) для метаданных",
    )
    dataBounds: DataBounds = Field(
        description="Диапазон доступных данных для выбора периода на графике",
    )
    revenueByDay: list[RevenueDay] = Field(
        description="Полный календарь периода, закрытые дни — нулями",
    )
    revenueByMonth: list[RevenueMonth] = Field(
        description="Помесячная выручка с начала года до последнего закрытого дня",
    )
    units: list[UnitSums] = Field(
        description="Всегда четыре элемента: k, b, w, o (нулевые включены)",
    )
    weekKpi: WeekKpiContext | None = Field(
        default=None,
        description="Контекст недельного датафрейма; null — month/year mode",
    )


class Dashboard(StrictModel):
    period: Period = Field(
        description="Показываемый период: месяц последнего закрытого дня"
    )
    compare: Period = Field(
        description="Период сравнения: непосредственно предшествующий период той же формы"
    )
    dataBounds: DataBounds = Field(
        description="Диапазон доступных данных для выбора периода на графике",
    )
    kpis: Kpis
    revenueByDay: list[RevenueDay] = Field(
        description="Полный календарь периода, закрытые дни — нулями"
    )
    revenueByMonth: list[RevenueMonth] = Field(
        description="Помесячная выручка с начала года до последнего закрытого дня"
    )
    units: list[UnitSums] = Field(
        description="Всегда четыре элемента: k, b, w, o (нулевые включены)"
    )
    weekKpi: WeekKpiContext | None = Field(
        default=None,
        description="Контекст недельного датафрейма; null — month/year mode",
    )
    reviews: None = None
    stock: None = None
