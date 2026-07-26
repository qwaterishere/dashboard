"""Общие SQL-агрегаты продаж: единый источник для REST и dashboard.

Деньги считаются в Decimal. Индекс: ix_orders_restaurant_day.
"""

from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from src.db.models.sales import DishSale, Order
from src.domain.constants import CAT_OTHER, resolve_unit
from src.services.analytics.money import money, zero

UNIT_KEYS = ('k', 'b', 'w', CAT_OTHER)


def data_bounds(
    session: Session, restaurant_id: UUID,
) -> tuple[date | None, date | None]:
    """Крайние даты с заказами в БД (не business closed-day)."""
    earliest, latest = session.query(
        func.min(Order.day), func.max(Order.day),
    ).filter(Order.restaurant_id == restaurant_id).one()
    return earliest, latest


def period_totals(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[str, Decimal | int]:
    """Выручка/себестоимость/чеки/гости за период.

    Два SQL обязательны: dish_sales и orders нельзя JOIN'ить —
    иначе гости умножаются на число блюд.
    """
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

    return {
        'revenue': money(revenue),
        'cost': money(cost),
        'checks': int(checks),
        'guests': int(guests),
    }


def period_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, dict[str, Decimal | int]]:
    """Метрики по дням. Дни без продаж отсутствуют. Ровно 2 SQL."""
    days: dict[date, dict[str, Decimal | int]] = {}

    for day, revenue in session.query(
        Order.day, func.coalesce(func.sum(DishSale.paid_sum), 0),
    ).join(DishSale).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(Order.day):
        days[day] = {'revenue': money(revenue), 'checks': 0, 'guests': 0}

    for day, checks, guests in session.query(
        Order.day, func.count(Order.id), func.sum(Order.guests_number),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(Order.day):
        entry = days.setdefault(
            day, {'revenue': zero(), 'checks': 0, 'guests': 0},
        )
        entry['checks'] = int(checks)
        entry['guests'] = int(guests or 0)

    return days


def period_monthly(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, dict[str, Decimal | int]]:
    """Агрегаты по календарным месяцам. Ровно 2 SQL (не O(месяцев)).

    Ключ — 1-е число месяца.
    """
    months: dict[date, dict[str, Decimal | int]] = {}
    year_col = extract('year', Order.day)
    month_col = extract('month', Order.day)

    for year, month, revenue in session.query(
        year_col,
        month_col,
        func.coalesce(func.sum(DishSale.paid_sum), 0),
    ).join(DishSale).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(year_col, month_col):
        key = date(int(year), int(month), 1)
        months[key] = {'revenue': money(revenue), 'checks': 0, 'guests': 0}

    for year, month, checks, guests in session.query(
        year_col,
        month_col,
        func.count(Order.id),
        func.coalesce(func.sum(Order.guests_number), 0),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(year_col, month_col):
        key = date(int(year), int(month), 1)
        entry = months.setdefault(
            key, {'revenue': zero(), 'checks': 0, 'guests': 0},
        )
        entry['checks'] = int(checks)
        entry['guests'] = int(guests)

    return months


def unit_sums(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[str, dict[str, Decimal]]:
    """Выручка/себестоимость по k/b/w/o; все ключи всегда присутствуют."""
    sums = {key: {'revenue': zero(), 'cost': zero()} for key in UNIT_KEYS}
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
        unit['revenue'] += money(revenue)
        unit['cost'] += money(cost)
    return sums


def default_month_period(
    session: Session, restaurant_id: UUID,
) -> tuple[date, date, date | None, date | None]:
    """Месяц последнего дня с данными → (from, to, earliest, latest)."""
    earliest, latest = data_bounds(session, restaurant_id)
    if latest is None:
        today = date.today()
        return today.replace(day=1), today, earliest, latest
    return latest.replace(day=1), latest, earliest, latest


def resolve_period(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    earliest: date | None | object = ...,
    latest: date | None | object = ...,
) -> tuple[date, date, date | None, date | None]:
    """Период дашборда/snapshot: явные даты, year/month или месяц последних данных.

    Возвращает (d_from, d_to, earliest, latest).
    """
    if earliest is ... or latest is ...:
        earliest, latest = data_bounds(session, restaurant_id)

    if date_from is not None or date_to is not None:
        if date_from is None or date_to is None:
            raise ValueError('date_from and date_to must be provided together')
        if date_from > date_to:
            raise ValueError('date_from must be on or before date_to')
        return date_from, date_to, earliest, latest  # type: ignore[return-value]

    if year is None and month is None:
        if latest is None:
            today = date.today()
            return today.replace(day=1), today, earliest, latest  # type: ignore[return-value]
        return latest.replace(day=1), latest, earliest, latest  # type: ignore[return-value]

    if year is not None and month is None:
        if latest is None:
            raise ValueError(f'No data for year {year}')
        last_in_year = session.query(func.max(Order.day)).filter(
            Order.restaurant_id == restaurant_id,
            Order.day >= date(year, 1, 1),
            Order.day <= date(year, 12, 31),
        ).scalar()
        if last_in_year is None:
            raise ValueError(f'No data for year {year}')
        return date(year, 1, 1), last_in_year, earliest, latest  # type: ignore[return-value]

    if year is None or month is None:
        raise ValueError('Both year and month are required')

    if latest is None or (year, month) > (latest.year, latest.month):
        raise ValueError('Period is in the future')

    d_from = date(year, month, 1)
    if (year, month) == (latest.year, latest.month):
        d_to = latest
    else:
        d_to = date(year, month, calendar.monthrange(year, month)[1])
    return d_from, d_to, earliest, latest  # type: ignore[return-value]
