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
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.domain.constants import resolve_unit, CAT_OTHER
from src.db.models.sales import Order, DishSale
from src.schemas.dashboard import Dashboard

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

def _same_period_last_year(d_from: date, d_to: date) -> tuple[date, date]:
    """Те же календарные числа прошлого года; 29 февраля -> 28-е."""
    def shift(d: date) -> date:
        try:
            return d.replace(year=d.year - 1)
        except ValueError:
            return d.replace(year=d.year - 1, day=28)
    return shift(d_from), shift(d_to)


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


def _forecast(daily: dict[date, dict], history: dict[date, dict], metric: str,
              d_from: date, d_to: date, days_in_month: int) -> float | None:
    """Run-rate: факт + средние по дням недели на оставшиеся дни месяца.

    None — прогноз не готов (< FORECAST_MIN_DAYS закрытых дней).
    Средний день недели — по РАБОЧИМ наблюдениям текущего месяца;
    если в месяце их ещё нет, берётся история за HISTORY_WEEKS недель:
      - работал в истории -> разовый простой, прогноз по историческому среднему;
      - не работал и там  -> регулярный выходной, прогноз 0.
    Ограничение: уровень исторического среднего может отставать от текущего
    месяца (сезонность) — цена за устойчивость к разовым закрытиям.
    """
    elapsed = (d_to - d_from).days + 1
    if elapsed < FORECAST_MIN_DAYS:
        return None

    current = _worked_by_weekday(daily, metric, d_from, d_to)
    hist_from = d_from - timedelta(weeks=HISTORY_WEEKS)
    historic = _worked_by_weekday(history, metric, hist_from,
                                  d_from - timedelta(days=1))

    # факт — все закрытые дни месяца как есть (нули прибавляют ноль)
    total = 0.0
    day = d_from
    while day <= d_to:
        total += float(daily.get(day, {}).get(metric, 0))
        day += timedelta(days=1)

    day = d_to + timedelta(days=1)
    month_end = d_from.replace(day=days_in_month)
    while day <= month_end:
        values = current[day.weekday()] or historic[day.weekday()]
        total += sum(values) / len(values) if values else 0.0
        day += timedelta(days=1)
    return round(total)


# --------------------------------------------------------------------------
# сборка
# --------------------------------------------------------------------------

def build_dashboard(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
) -> Dashboard:
    d_from, d_to, earliest, latest = _resolve_dashboard_period(
        session, restaurant_id, year=year, month=month,
    )
    if latest is None:
        return _assemble_response(
            d_from=d_from,
            d_to=d_to,
            cur=_ZERO_TOTALS,
            prev=None,
            daily={},
            units=_zero_units(),
            prev_units=_zero_units(),
            forecasts={'revenue': None, 'checks': None, 'guests': None},
            monthly=[],
            earliest=earliest,
            latest=latest,
        )

    prev_from, prev_to = _same_period_last_year(d_from, d_to)
    days_in_month = calendar.monthrange(d_from.year, d_from.month)[1]

    cur = _totals(session, restaurant_id, d_from, d_to)
    prev_raw = _totals(session, restaurant_id, prev_from, prev_to)
    prev = prev_raw if prev_raw['checks'] > 0 else None

    daily = _daily(session, restaurant_id, d_from, d_to)
    history = _daily(
        session,
        restaurant_id,
        d_from - timedelta(weeks=HISTORY_WEEKS),
        d_from - timedelta(days=1),
    )
    forecasts = {m: _forecast(daily, history, m, d_from, d_to, days_in_month)
                 for m in ('revenue', 'checks', 'guests')}
    monthly = _monthly(session, restaurant_id, d_to)

    return _assemble_response(
        d_from,
        d_to,
        cur,
        prev,
        daily,
        _unit_sums(session, restaurant_id, d_from, d_to),
        _unit_sums(session, restaurant_id, prev_from, prev_to),
        forecasts,
        monthly,
        earliest,
        latest,
    )


_ZERO_TOTALS = {'revenue': 0.0, 'cost': 0.0, 'checks': 0, 'guests': 0}


def _zero_units() -> dict[str, dict]:
    return {key: {'revenue': 0.0, 'cost': 0.0} for key in UNIT_KEYS}


def _assemble_response(d_from: date, d_to: date, cur: dict, prev: dict | None,
              daily: dict, units: dict, prev_units: dict,
              forecasts: dict, monthly: list[dict],
              earliest: date | None, latest: date | None) -> Dashboard:
    def metric(name: str) -> dict:
        return {'value': cur[name],
                'prevValue': prev[name] if prev else None,
                'forecast': forecasts[name]}

    avg_check = {
        'value': round(cur['revenue'] / cur['checks']) if cur['checks'] else 0,
        'prevValue': (round(prev['revenue'] / prev['checks'])
                 if prev and prev['checks'] else None),
        'forecast': (round(forecasts['revenue'] / forecasts['checks'])
                     if forecasts['revenue'] and forecasts['checks'] else None),
    }

    revenue_by_day = []
    if (d_to - d_from).days <= 31:
        day = d_from
        while day <= d_to:
            m = daily.get(day, {'revenue': 0.0, 'checks': 0, 'guests': 0})
            revenue_by_day.append({
                'day': day.day,
                'weekday': (day.weekday() + 1) % 7,
                'revenue': round(m['revenue']),
                'checks': m['checks'],
                'guests': m['guests'],
                'plan': None,
            })
            day += timedelta(days=1)

    p_from, p_to = _same_period_last_year(d_from, d_to)
    return Dashboard.model_validate({
        'period': _period_dict(d_from, d_to),
        'compare': _period_dict(p_from, p_to),
        'dataBounds': {'earliest': earliest, 'latest': latest},
        'kpis': {'revenue': metric('revenue'),
                 'checks': metric('checks'),
                 'guests': metric('guests'),
                 'avgCheck': avg_check},
        'revenueByDay': revenue_by_day,
        'revenueByMonth': monthly,
        'units': [{'key': key,
                   'revenue': round(units[key]['revenue']),
                   'cost': round(units[key]['cost']),
                   'prevRevenue': round(prev_units[key]['revenue']),
                   'prevCost': round(prev_units[key]['cost'])}
                  for key in UNIT_KEYS],
        'reviews': None,
        'stock': None,
    })