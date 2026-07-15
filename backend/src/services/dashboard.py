"""Сборка данных страницы «Дашборд» (контракт v2).

Бэкенд отдаёт факты; проценты, доли, форматирование — зона фронтенда
(docs/frontend-handoff.md, раздел 1). Семантика пустоты:
  None -> «данных нет» (нет прошлого года, прогноз не готов, планы не внесены);
  0    -> честный ноль из данных (день закрыт, юнит без продаж).

Продажные метрики (чеки/гости/средний чек) считаются только по чекам
с выручкой (Order.paid_total > 0): целиком бесплатные чеки
(представительские, стафф) — не продажи. Выручке фильтр безразличен:
бесплатное прибавляет ноль. Гости смешанного чека (платный чек
с бесплатными позициями) считаются все — гости настоящие.
"""
import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.domain.constants import resolve_unit, CAT_OTHER
from src.db.models.sales import Order, DishSale
from src.schemas.dashboard import Dashboard, DashboardChart, DashboardKpi
from src.services.period_compare import previous_period as _previous_period

# Прогноз считается от 7 закрытых дней: первая неделя месяца покрывает
# каждый день недели ровно один раз — раньше run-rate экстраполирует шум.
FORECAST_MIN_DAYS = 7

# Окно истории для распознавания выходных: день недели, не работавший
# ни разу за столько недель, считается регулярным выходным (прогноз 0).
# Данные берутся из нашей БД — реплики iiko, ходить в кассу не нужно.
HISTORY_WEEKS = 8

UNIT_KEYS = ('k', 'b', 'w', CAT_OTHER)   # порядок элементов units в ответе


# --------------------------------------------------------------------------
# периоды
# --------------------------------------------------------------------------

def _period_dict(d_from: date, d_to: date) -> dict:
    return {'year': d_from.year, 'month': d_from.month,
            'dayFrom': d_from.day, 'dayTo': d_to.day}


# --------------------------------------------------------------------------
# запросы (никаких JOIN-агрегатов заказов с блюдами — гости и чеки
# считаются по orders отдельно, иначе суммы умножаются на число блюд)
# --------------------------------------------------------------------------

def _totals(session: Session, restaurant_id: UUID, d_from: date, d_to: date) -> dict:
    revenue, cost = session.query(
        func.coalesce(func.sum(DishSale.paid_sum), 0),
        func.coalesce(func.sum(func.coalesce(DishSale.cost, 0)), 0),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).one()

    checks, guests = session.query(
        func.count(Order.id),
        func.coalesce(func.sum(Order.guests_number), 0),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).one()

    return {'revenue': float(revenue), 'cost': float(cost),
            'checks': int(checks), 'guests': int(guests)}


def _daily(session: Session, restaurant_id: UUID, d_from: date, d_to: date) -> dict[date, dict]:
    """Метрики по дням двумя запросами. Дни без продаж отсутствуют
    в словаре — календарную сетку с нулями достраивает build_dashboard."""
    days: dict[date, dict] = {}

    for day, revenue in session.query(
            Order.day, func.sum(DishSale.paid_sum),
    ).join(DishSale).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(Order.day):
        days[day] = {'revenue': float(revenue), 'checks': 0, 'guests': 0}

    for day, checks, guests in session.query(
            Order.day, func.count(Order.id), func.sum(Order.guests_number),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(Order.day):
        entry = days.setdefault(day, {'revenue': 0.0})
        entry['checks'] = int(checks)
        entry['guests'] = int(guests)

    return days


def _monthly(session: Session, restaurant_id: UUID, last_day: date) -> list[dict]:
    """YTD: месяцы с 1-го числа года до last_day включительно."""
    year = last_day.year
    months: list[dict] = []
    for month in range(1, last_day.month + 1):
        d_from = date(year, month, 1)
        d_to = last_day if month == last_day.month else date(
            year, month, calendar.monthrange(year, month)[1],
        )
        totals = _totals(session, restaurant_id, d_from, d_to)
        months.append({
            'month': month,
            'revenue': round(totals['revenue']),
            'checks': totals['checks'],
            'guests': totals['guests'],
            'plan': None,
            'forecast': None,
        })
    while len(months) > 1 and months[0]['revenue'] == 0 and months[0]['checks'] == 0:
        months.pop(0)
    return months


def _data_bounds(session: Session, restaurant_id: UUID) -> tuple[date | None, date | None]:
    earliest = session.query(func.min(Order.day)).filter(
        Order.restaurant_id == restaurant_id,
    ).scalar()
    latest = session.query(func.max(Order.day)).filter(
        Order.restaurant_id == restaurant_id,
    ).scalar()
    return earliest, latest


def _resolve_dashboard_period(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
) -> tuple[date, date, date | None, date | None]:
    """Возвращает (d_from, d_to, earliest, latest) для сборки дашборда."""
    earliest, latest = _data_bounds(session, restaurant_id)
    if latest is None:
        today = date.today()
        return today.replace(day=1), today, earliest, latest

    if year is None and month is None:
        return latest.replace(day=1), latest, earliest, latest

    if year is not None and month is None:
        last_in_year = session.query(func.max(Order.day)).filter(
            Order.restaurant_id == restaurant_id,
            Order.day >= date(year, 1, 1),
            Order.day <= date(year, 12, 31),
        ).scalar()
        if last_in_year is None:
            raise ValueError(f"No data for year {year}")
        return date(year, 1, 1), last_in_year, earliest, latest

    if year is None or month is None:
        raise ValueError("Both year and month are required")

    if (year, month) > (latest.year, latest.month):
        raise ValueError("Period is in the future")

    d_from = date(year, month, 1)
    if (year, month) == (latest.year, latest.month):
        d_to = latest
    else:
        d_to = date(year, month, calendar.monthrange(year, month)[1])
    return d_from, d_to, earliest, latest


def _unit_sums(session: Session, restaurant_id: UUID, d_from: date, d_to: date) -> dict[str, dict]:
    """Выручка/себестоимость по k/b/w/o. Все четыре ключа присутствуют
    всегда (юнит без продаж — нулями): у кофейни без вина w будет 0."""
    sums = {key: {'revenue': 0.0, 'cost': 0.0} for key in UNIT_KEYS}
    rows = session.query(
        DishSale.top_group,
        func.sum(DishSale.paid_sum),
        func.sum(func.coalesce(DishSale.cost, 0)),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(DishSale.top_group)
    for top_group, revenue, cost in rows:
        unit = sums[resolve_unit(top_group)]
        unit['revenue'] += float(revenue)
        unit['cost'] += float(cost)
    return sums


# --------------------------------------------------------------------------
# прогноз
# --------------------------------------------------------------------------

def _worked_by_weekday(daily: dict[date, dict], metric: str,
                       d_from: date, d_to: date) -> dict[int, list[float]]:
    """Рабочие (ненулевые) значения метрики по дням недели за период.

    Нули не участвуют в средних: разовый простой (праздник, форс-мажор) —
    шум, а не свойство дня недели.
    """
    by_weekday: dict[int, list[float]] = {i: [] for i in range(7)}
    day = d_from
    while day <= d_to:
        value = float(daily.get(day, {}).get(metric, 0))
        if value > 0:
            by_weekday[day.weekday()].append(value)
        day += timedelta(days=1)
    return by_weekday


def _forecast_horizon(d_from: date, *, year_mode: bool) -> date:
    """Конец горизонта прогноза: конец месяца или 31 декабря года."""
    if year_mode:
        return date(d_from.year, 12, 31)
    last_day = calendar.monthrange(d_from.year, d_from.month)[1]
    return date(d_from.year, d_from.month, last_day)


def _weekday_mean(
    current: dict[int, list[float]],
    historic: dict[int, list[float]],
    weekday: int,
) -> float:
    values = current[weekday] or historic[weekday]
    return sum(values) / len(values) if values else 0.0


@dataclass(frozen=True)
class ForecastContext:
    """Weekday-модель для KPI и засечек графика."""

    current: dict[int, list[float]]
    historic: dict[int, list[float]]
    ready: bool


def _load_forecast_context(
    session: Session,
    restaurant_id: UUID,
    d_from: date,
    d_to: date,
    metric: str = 'revenue',
) -> ForecastContext:
    elapsed = (d_to - d_from).days + 1
    if elapsed < FORECAST_MIN_DAYS:
        empty = {i: [] for i in range(7)}
        return ForecastContext(empty, empty, False)

    daily = _daily(session, restaurant_id, d_from, d_to)
    history = _daily(
        session,
        restaurant_id,
        d_from - timedelta(weeks=HISTORY_WEEKS),
        d_from - timedelta(days=1),
    )
    hist_from = d_from - timedelta(weeks=HISTORY_WEEKS)
    return ForecastContext(
        current=_worked_by_weekday(daily, metric, d_from, d_to),
        historic=_worked_by_weekday(
            history, metric, hist_from, d_from - timedelta(days=1),
        ),
        ready=True,
    )


def _daily_forecast_value(ctx: ForecastContext, calendar_day: date) -> float | None:
    if not ctx.ready:
        return None
    value = _weekday_mean(ctx.current, ctx.historic, calendar_day.weekday())
    rounded = round(value)
    return rounded if rounded > 0 else None


def _month_forecast_total(
    ctx: ForecastContext,
    year: int,
    month: int,
    *,
    last_day: int | None = None,
) -> float | None:
    if not ctx.ready:
        return None
    month_last = last_day or calendar.monthrange(year, month)[1]
    total = 0.0
    for day_num in range(1, month_last + 1):
        total += _weekday_mean(
            ctx.current,
            ctx.historic,
            date(year, month, day_num).weekday(),
        )
    return round(total)


def _revenue_by_day_chart_end(d_from: date, d_to: date) -> date:
    """Конец календаря revenueByDay: полный месяц, если период с 1-го числа."""
    if d_from.day != 1:
        return d_to
    month_last = calendar.monthrange(d_from.year, d_from.month)[1]
    return date(d_from.year, d_from.month, month_last)


def _build_revenue_by_day(
    daily: dict[date, dict],
    d_from: date,
    d_to: date,
    ctx: ForecastContext,
) -> list[dict]:
    if (d_to - d_from).days > 31:
        return []

    chart_end = _revenue_by_day_chart_end(d_from, d_to)
    rows: list[dict] = []
    day = d_from
    while day <= chart_end:
        m = daily.get(day, {'revenue': 0.0, 'checks': 0, 'guests': 0})
        rows.append({
            'day': day.day,
            'weekday': (day.weekday() + 1) % 7,
            'revenue': round(m['revenue']),
            'checks': m['checks'],
            'guests': m['guests'],
            'plan': None,
            'forecast': _daily_forecast_value(ctx, day),
        })
        day += timedelta(days=1)
    return rows


def _monthly_with_forecasts(
    monthly: list[dict],
    ctx: ForecastContext,
    year: int,
) -> list[dict]:
    return [
        {
            **row,
            'forecast': _month_forecast_total(ctx, year, row['month']),
        }
        for row in monthly
    ]


def _load_forecast_context_for_metric(
    daily: dict[date, dict],
    history: dict[date, dict],
    d_from: date,
    d_to: date,
    metric: str,
) -> ForecastContext:
    elapsed = (d_to - d_from).days + 1
    if elapsed < FORECAST_MIN_DAYS:
        empty = {i: [] for i in range(7)}
        return ForecastContext(empty, empty, False)
    hist_from = d_from - timedelta(weeks=HISTORY_WEEKS)
    return ForecastContext(
        current=_worked_by_weekday(daily, metric, d_from, d_to),
        historic=_worked_by_weekday(
            history, metric, hist_from, d_from - timedelta(days=1),
        ),
        ready=True,
    )


def _forecast_and_pace_for_metric(
    daily: dict[date, dict],
    history: dict[date, dict],
    metric: str,
    d_from: date,
    d_to: date,
    horizon_end: date,
) -> tuple[float | None, float | None]:
    ctx = _load_forecast_context_for_metric(
        daily, history, d_from, d_to, metric,
    )
    if not ctx.ready:
        return None, None

    fact = 0.0
    day = d_from
    while day <= d_to:
        fact += float(daily.get(day, {}).get(metric, 0))
        day += timedelta(days=1)

    projected = 0.0
    day = d_to + timedelta(days=1)
    while day <= horizon_end:
        projected += _weekday_mean(ctx.current, ctx.historic, day.weekday())
        day += timedelta(days=1)

    forecast = round(fact + projected)
    if d_to >= horizon_end:
        return forecast, None

    pace = 0.0
    day = d_from
    while day <= d_to:
        pace += _weekday_mean(ctx.current, ctx.historic, day.weekday())
        day += timedelta(days=1)

    return forecast, round(pace)


def _forecasts_for_period(
    session: Session,
    restaurant_id: UUID,
    d_from: date,
    d_to: date,
    *,
    year_mode: bool,
) -> tuple[dict[str, float | None], dict[str, float | None]]:
    """Прогноз до конца периода и pace к d_to для revenue/checks/guests."""
    horizon_end = _forecast_horizon(d_from, year_mode=year_mode)
    daily = _daily(session, restaurant_id, d_from, d_to)
    history = _daily(
        session,
        restaurant_id,
        d_from - timedelta(weeks=HISTORY_WEEKS),
        d_from - timedelta(days=1),
    )
    forecasts: dict[str, float | None] = {}
    paces: dict[str, float | None] = {}
    for m in ('revenue', 'checks', 'guests'):
        forecasts[m], paces[m] = _forecast_and_pace_for_metric(
            daily, history, m, d_from, d_to, horizon_end,
        )
    return forecasts, paces


# --------------------------------------------------------------------------
# сборка
# --------------------------------------------------------------------------

def _resolve_compare_period(
    d_from: date,
    d_to: date,
    compare_start: date | None,
    compare_end: date | None,
) -> tuple[date, date]:
    if compare_start is None and compare_end is None:
        return _previous_period(d_from, d_to)
    if compare_start is None or compare_end is None:
        raise ValueError("compareStart and compareEnd must be provided together")
    if compare_start > compare_end:
        raise ValueError("compareStart must be on or before compareEnd")
    return compare_start, compare_end


def _ratio_or_none(num: float | None, den: float | None) -> float | None:
    if num and den:
        return round(num / den)
    return None


def _build_kpis(
    cur: dict,
    prev: dict | None,
    forecasts: dict[str, float | None],
    paces: dict[str, float | None],
) -> dict:
    def metric(name: str) -> dict:
        return {
            'value': cur[name],
            'prevValue': prev[name] if prev else None,
            'forecast': forecasts[name],
            'forecastToday': paces[name],
        }

    avg_check = {
        'value': round(cur['revenue'] / cur['checks']) if cur['checks'] else 0,
        'prevValue': (round(prev['revenue'] / prev['checks'])
                 if prev and prev['checks'] else None),
        'forecast': _ratio_or_none(forecasts['revenue'], forecasts['checks']),
        'forecastToday': _ratio_or_none(paces['revenue'], paces['checks']),
    }

    return {
        'revenue': metric('revenue'),
        'checks': metric('checks'),
        'guests': metric('guests'),
        'avgCheck': avg_check,
    }


def _empty_kpis() -> dict:
    empty = {
        'value': 0,
        'prevValue': None,
        'forecast': None,
        'forecastToday': None,
    }
    return {
        'revenue': dict(empty),
        'checks': dict(empty),
        'guests': dict(empty),
        'avgCheck': dict(empty),
    }


def _assemble_chart_response(
    d_from: date,
    d_to: date,
    daily: dict,
    units: dict,
    prev_units: dict,
    monthly: list[dict],
    earliest: date | None,
    latest: date | None,
    *,
    compare_from: date,
    compare_to: date,
    forecast_ctx: ForecastContext,
    week_kpi: dict | None = None,
) -> DashboardChart:
    revenue_by_day = _build_revenue_by_day(daily, d_from, d_to, forecast_ctx)
    revenue_by_month = _monthly_with_forecasts(monthly, forecast_ctx, d_from.year)

    return DashboardChart.model_validate({
        'period': _period_dict(d_from, d_to),
        'compare': _period_dict(compare_from, compare_to),
        'dataBounds': {'earliest': earliest, 'latest': latest},
        'revenueByDay': revenue_by_day,
        'revenueByMonth': revenue_by_month,
        'units': [{'key': key,
                   'revenue': round(units[key]['revenue']),
                   'cost': round(units[key]['cost']),
                   'prevRevenue': round(prev_units[key]['revenue']),
                   'prevCost': round(prev_units[key]['cost'])}
                  for key in UNIT_KEYS],
        'weekKpi': week_kpi,
    })


def build_dashboard_chart(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
    week_start: date | None = None,
    week_end: date | None = None,
) -> DashboardChart:
    """Chart-слой без KPI, прогноза и custom compare — для смены датафрейма."""
    d_from, d_to, earliest, latest = _resolve_dashboard_period(
        session, restaurant_id, year=year, month=month,
    )
    compare_from, compare_to = _previous_period(d_from, d_to)
    empty_ctx = ForecastContext({i: [] for i in range(7)}, {i: [] for i in range(7)}, False)

    if latest is None:
        return _assemble_chart_response(
            d_from=d_from,
            d_to=d_to,
            daily={},
            units=_zero_units(),
            prev_units=_zero_units(),
            monthly=[],
            earliest=earliest,
            latest=latest,
            compare_from=compare_from,
            compare_to=compare_to,
            forecast_ctx=empty_ctx,
        )

    daily = _daily(session, restaurant_id, d_from, d_to)
    monthly = _monthly(session, restaurant_id, d_to)
    forecast_ctx = _load_forecast_context(session, restaurant_id, d_from, d_to)

    chart = _assemble_chart_response(
        d_from,
        d_to,
        daily,
        _unit_sums(session, restaurant_id, d_from, d_to),
        _unit_sums(session, restaurant_id, compare_from, compare_to),
        monthly,
        earliest,
        latest,
        compare_from=compare_from,
        compare_to=compare_to,
        forecast_ctx=forecast_ctx,
    )

    if week_start is not None or week_end is not None:
        from src.services.dashboard_week import build_week_kpi_overlay

        if week_start is None or week_end is None:
            raise ValueError("weekStart and weekEnd must be provided together")
        if year is None or month is None:
            raise ValueError("year and month are required for week chart")
        overlay = build_week_kpi_overlay(
            session,
            restaurant_id,
            week_start=week_start,
            week_end=week_end,
            anchor_year=year,
            anchor_month=month,
            latest=latest,
        )
        payload = chart.model_dump()
        payload.update({
            "compare": overlay["compare"],
            "weekKpi": overlay["weekKpi"],
        })
        return DashboardChart.model_validate(payload)

    return chart


def build_dashboard_kpi(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
    week_start: date | None = None,
    week_end: date | None = None,
    compare_start: date | None = None,
    compare_end: date | None = None,
) -> DashboardKpi:
    """KPI-слой без графика, юнитов и YTD — для LfL overlay на фронте."""
    d_from, d_to, _earliest, latest = _resolve_dashboard_period(
        session, restaurant_id, year=year, month=month,
    )
    compare_from, compare_to = _resolve_compare_period(
        d_from, d_to, compare_start, compare_end,
    )

    if latest is None:
        return DashboardKpi.model_validate({
            'period': _period_dict(d_from, d_to),
            'compare': _period_dict(compare_from, compare_to),
            'kpis': _empty_kpis(),
            'weekKpi': None,
        })

    if week_start is not None or week_end is not None:
        from src.services.dashboard_week import build_week_kpi_overlay

        if week_start is None or week_end is None:
            raise ValueError("weekStart and weekEnd must be provided together")
        if year is None or month is None:
            raise ValueError("year and month are required for week KPI")
        overlay = build_week_kpi_overlay(
            session,
            restaurant_id,
            week_start=week_start,
            week_end=week_end,
            anchor_year=year,
            anchor_month=month,
            latest=latest,
            compare_start=compare_start,
            compare_end=compare_end,
        )
        return DashboardKpi.model_validate({
            'period': _period_dict(d_from, d_to),
            'compare': overlay['compare'],
            'kpis': overlay['kpis'],
            'weekKpi': overlay['weekKpi'],
        })

    year_mode = year is not None and month is None
    cur = _totals(session, restaurant_id, d_from, d_to)
    prev_raw = _totals(session, restaurant_id, compare_from, compare_to)
    prev = prev_raw if prev_raw['checks'] > 0 else None
    forecasts, paces = _forecasts_for_period(
        session, restaurant_id, d_from, d_to, year_mode=year_mode,
    )

    return DashboardKpi.model_validate({
        'period': _period_dict(d_from, d_to),
        'compare': _period_dict(compare_from, compare_to),
        'kpis': _build_kpis(cur, prev, forecasts, paces),
        'weekKpi': None,
    })


def build_dashboard(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
    week_start: date | None = None,
    week_end: date | None = None,
    compare_start: date | None = None,
    compare_end: date | None = None,
) -> Dashboard:
    d_from, d_to, earliest, latest = _resolve_dashboard_period(
        session, restaurant_id, year=year, month=month,
    )
    if latest is None:
        compare_from, compare_to = _resolve_compare_period(
            d_from, d_to, compare_start, compare_end,
        )
        empty_ctx = ForecastContext(
            {i: [] for i in range(7)}, {i: [] for i in range(7)}, False,
        )
        return _assemble_response(
            d_from=d_from,
            d_to=d_to,
            cur=_ZERO_TOTALS,
            prev=None,
            daily={},
            units=_zero_units(),
            prev_units=_zero_units(),
            forecasts={'revenue': None, 'checks': None, 'guests': None},
            paces={'revenue': None, 'checks': None, 'guests': None},
            monthly=[],
            earliest=earliest,
            latest=latest,
            compare_from=compare_from,
            compare_to=compare_to,
            forecast_ctx=empty_ctx,
        )

    compare_from, compare_to = _resolve_compare_period(
        d_from, d_to, compare_start, compare_end,
    )
    year_mode = year is not None and month is None

    cur = _totals(session, restaurant_id, d_from, d_to)
    prev_raw = _totals(session, restaurant_id, compare_from, compare_to)
    prev = prev_raw if prev_raw['checks'] > 0 else None

    daily = _daily(session, restaurant_id, d_from, d_to)
    forecasts, paces = _forecasts_for_period(
        session, restaurant_id, d_from, d_to, year_mode=year_mode,
    )
    forecast_ctx = _load_forecast_context(session, restaurant_id, d_from, d_to)
    monthly = _monthly(session, restaurant_id, d_to)

    dashboard = _assemble_response(
        d_from,
        d_to,
        cur,
        prev,
        daily,
        _unit_sums(session, restaurant_id, d_from, d_to),
        _unit_sums(session, restaurant_id, compare_from, compare_to),
        forecasts,
        paces,
        monthly,
        earliest,
        latest,
        compare_from=compare_from,
        compare_to=compare_to,
        forecast_ctx=forecast_ctx,
    )

    if week_start is not None or week_end is not None:
        from src.services.dashboard_week import build_week_kpi_overlay

        if week_start is None or week_end is None:
            raise ValueError("weekStart and weekEnd must be provided together")
        if year is None or month is None:
            raise ValueError("year and month are required for week KPI")
        overlay = build_week_kpi_overlay(
            session,
            restaurant_id,
            week_start=week_start,
            week_end=week_end,
            anchor_year=year,
            anchor_month=month,
            latest=latest,
            compare_start=compare_start,
            compare_end=compare_end,
        )
        payload = dashboard.model_dump()
        payload.update({
            "kpis": overlay["kpis"],
            "compare": overlay["compare"],
            "weekKpi": overlay["weekKpi"],
        })
        return Dashboard.model_validate(payload)

    return dashboard


_ZERO_TOTALS = {'revenue': 0.0, 'cost': 0.0, 'checks': 0, 'guests': 0}


def _zero_units() -> dict[str, dict]:
    return {key: {'revenue': 0.0, 'cost': 0.0} for key in UNIT_KEYS}


def _assemble_response(d_from: date, d_to: date, cur: dict, prev: dict | None,
              daily: dict, units: dict, prev_units: dict,
              forecasts: dict, paces: dict, monthly: list[dict],
              earliest: date | None, latest: date | None,
              *, compare_from: date, compare_to: date,
              forecast_ctx: ForecastContext) -> Dashboard:
    revenue_by_day = _build_revenue_by_day(daily, d_from, d_to, forecast_ctx)
    revenue_by_month = _monthly_with_forecasts(monthly, forecast_ctx, d_from.year)

    return Dashboard.model_validate({
        'period': _period_dict(d_from, d_to),
        'compare': _period_dict(compare_from, compare_to),
        'dataBounds': {'earliest': earliest, 'latest': latest},
        'kpis': _build_kpis(cur, prev, forecasts, paces),
        'revenueByDay': revenue_by_day,
        'revenueByMonth': revenue_by_month,
        'units': [{'key': key,
                   'revenue': round(units[key]['revenue']),
                   'cost': round(units[key]['cost']),
                   'prevRevenue': round(prev_units[key]['revenue']),
                   'prevCost': round(prev_units[key]['cost'])}
                  for key in UNIT_KEYS],
        'reviews': None,
        'stock': None,
    })