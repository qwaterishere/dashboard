"""REST-слой метрик дашборда: одна метрика — одна ручка (/api/metrics/*).

Только факты из продаж: план сюда не подмешивается — план принадлежит
домену Целей (/api/targets).

Слой — детерминированный калькулятор: считает ровно по запрошенным датам,
ничего не усекая и не подменяя. Края истории данных клиент узнаёт ручкой
bounds и сам решает, какой период честно спрашивать. Следствие, о котором
надо помнить: запросишь период шире данных — получишь сумму по имеющейся
части без предупреждения;

Правила подсчёта — единые с dashboard (см. его docstring):
  - выручка = сумма фактических оплат по блюдам; фильтр «чек с оплатой»
    ей не нужен — бесплатные позиции прибавляют ноль;
  - чеки/гости — только чеки с выручкой (paid_total > 0): целиком
    бесплатные чеки (представительские, стафф) — не продажи;
  - никаких JOIN-агрегатов заказов с блюдами: чеки и гости считаются
    по orders отдельно, иначе суммы умножаются на число блюд.

Семантика пустоты:
  None -> «делить не на что» (метрики-дроби без чеков/гостей);
      0-> честный ноль (в диапазоне нет продаж).
"""
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.src.db.models.sales import DishSale, Order
from backend.src.services.period_compare import previous_period

# Метрики-дроби: значение периода = сумма числителя / сумма знаменателя.
# НЕ средняя дневных средних — та даёт слабым дням тот же вес, что сильным.
_RATIO= {
    'avg-check': ('revenue', 'checks'),
    'avg-check-per-guest': ('revenue', 'guests'),
}


# --------------------------------------------------------------------------
# запросы: по одному на метрику
# --------------------------------------------------------------------------

def _revenue_total(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> float:
    value = session.query(
        func.coalesce(func.sum(DishSale.paid_sum), 0),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).scalar()
    return float(value)


def _checks_total(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> int:
    value = session.query(func.count(Order.id)).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).scalar()
    return int(value)


def _guests_total(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> int:
    value = session.query(
        func.coalesce(func.sum(Order.guests_number), 0),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).scalar()
    return int(value)


def _revenue_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, float]:
    rows = session.query(
        Order.day, func.sum(DishSale.paid_sum),
    ).join(DishSale).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(Order.day)
    return {day: float(value) for day, value in rows}


def _checks_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, int]:
    rows = session.query(
        Order.day, func.count(Order.id),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(Order.day)
    return {day: int(value) for day, value in rows}


def _guests_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, int]:
    rows = session.query(
        Order.day, func.sum(Order.guests_number),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(Order.day)
    return {day: int(value or 0) for day, value in rows}


# Реестры «имя метрики -> её запрос». Дроби собираются из базовых
# запросов числителя и знаменателя — своего SQL у них нет.
_TOTAL_QUERY = {
    'revenue': _revenue_total,
    'checks': _checks_total,
    'guests': _guests_total,
}
_DAILY_QUERY = {
    'revenue': _revenue_daily,
    'checks': _checks_daily,
    'guests': _guests_daily,
}


def _period_value(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> float | int | None:
    """Значение метрики за период: базовая — один запрос;
    дробь — два (знаменатель первым: он ноль — числитель не нужен)."""
    if metric in _RATIO:
        num, den = _RATIO[metric]
        den_value = _TOTAL_QUERY[den](session, restaurant_id, d_from, d_to)
        if not den_value:
            return None
        num_value = _TOTAL_QUERY[num](session, restaurant_id, d_from, d_to)
        return round(num_value / den_value)
    value = _TOTAL_QUERY[metric](session, restaurant_id, d_from, d_to)
    return round(value) if metric == 'revenue' else value


# --------------------------------------------------------------------------
# ручки
# --------------------------------------------------------------------------

def metric_bounds(session: Session, restaurant_id: UUID) -> dict:
    """GET /api/metrics/bounds — края истории данных.

    Клиент сверяется с ними, чтобы не запрашивать периоды шире данных
    и не сравнивать с полупустой базой."""
    earliest, latest = session.query(
        func.min(Order.day), func.max(Order.day),
    ).filter(Order.restaurant_id == restaurant_id).one()
    return {'date_from': earliest, 'date_to': latest}


def metric_fact(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> dict:
    """GET /api/metrics/{metric} — факт ровно за запрошенный период."""
    return {
        'date_from': d_from,
        'date_to': d_to,
        'value': _period_value(session, restaurant_id, metric, d_from, d_to),
    }


def metric_lfl(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> dict:
    """GET /api/metrics/{metric}/lfl — факт против предшествующего периода
    той же формы (правило дат — period_compare.previous_period, единое
    с BFF и фудкостом). Дельту в % считает клиент из двух сырых значений.

    Слой НЕ проверяет, покрыта ли база данными: base_value за период
    до начала истории — честный ноль по запросу, а не «данных не было».
    Клиент, которому важно, сверяется с metric_bounds."""
    base_from, base_to = previous_period(d_from, d_to)
    fact = metric_fact(session, restaurant_id, metric, d_from, d_to)
    base = metric_fact(session, restaurant_id, metric, base_from, base_to)
    return {
        **fact,
        'base_date_from': base['date_from'],
        'base_date_to': base['date_to'],
        'base_value': base['value'],
    }


def metric_series(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> dict:
    """GET /api/metrics/{metric}/series — ряд по дням для графика.

    Календарная сетка сплошная по всему запрошенному диапазону:
    день без продаж -> 0 (метрики-дроби -> None, делить не на что)."""
    if metric in _RATIO:
        num, den = _RATIO[metric]
        num_daily = _DAILY_QUERY[num](session, restaurant_id, d_from, d_to)
        den_daily = _DAILY_QUERY[den](session, restaurant_id, d_from, d_to)

        def day_value(day: date) -> int | None:
            den_v = den_daily.get(day, 0)
            return round(num_daily.get(day, 0.0) / den_v) if den_v else None
    else:
        daily = _DAILY_QUERY[metric](session, restaurant_id, d_from, d_to)

        def day_value(day: date) -> float | int:
            value = daily.get(day, 0)
            return round(value) if metric == 'revenue' else value

    points = []
    day = d_from
    while day <= d_to:
        points.append({'date': day, 'value': day_value(day)})
        day += timedelta(days=1)
    return {'date_from': d_from, 'date_to': d_to,
            'granularity': 'day', 'points': points}