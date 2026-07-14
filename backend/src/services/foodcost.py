"""Сборка данных страницы «Фудкост»

Правило учёта строк:
  продажная строка — paid_sum > 0;
  фудкост-строка   — paid_sum > 0
  cost > 0 (и числитель, и знаменатель:
  бизнес-ланч без техкарты не размывает знаменатель,
  комплимент не добавляет себестоимость без выручки).
Производные (fc% = cost/revenueWithCost, покрытие = revenueWithCost/revenue,
LfL, «фудкост без скидок») — зона фронтенда.

TODO(staff): staff-механика отложена (карточка №9) — фильтров NOT is_staff
нет, losses.staff отдаёт нули.
"""
from datetime import date
from uuid import UUID

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from src.db.models.sales import DishSale, Order
from src.domain.constants import CAT_OTHER, resolve_unit
from src.schemas.foodcost import Foodcost
# TODO(обсудить): периодные хелперы просятся из дашборда в общий
# src/services/periods.py — пока импортируем как есть (пункт 1 обсуждения).
from src.services.dashboard import (
    _period_dict,
    _resolve_dashboard_period,
)
from src.services.period_compare import previous_period as _previous_period

UNIT_KEYS = ('k', 'b', 'w', CAT_OTHER)


def _zero_sums() -> dict:
    return {'revenue': 0.0, 'cost': 0.0, 'revenueWithCost': 0.0}


# --------------------------------------------------------------------------
# запросы (каждый — один проход по строкам периода)
# --------------------------------------------------------------------------

def _sum_columns():
    """Тройка сумм правила №3: revenue / cost / revenueWithCost."""
    in_sale = DishSale.paid_sum > 0
    in_foodcost = in_sale & (func.coalesce(DishSale.cost, 0) > 0)
    return (
        # внешний coalesce: SUM по пустому периоду — NULL, а не 0
        func.coalesce(func.sum(case((in_sale, DishSale.paid_sum), else_=0)), 0),
        func.coalesce(func.sum(case((in_foodcost, DishSale.cost), else_=0)), 0),
        func.coalesce(func.sum(case((in_foodcost, DishSale.paid_sum), else_=0)), 0),
    )


def _cost_rows(session: Session, restaurant_id: UUID,
               d_from: date, d_to: date, *dimensions):
    """Базовый запрос страницы: тройка сумм правила №3 в разрезе dimensions
    (пусто — тоталы одной строкой, top_group — юниты, +dish_group — группы)."""
    query = session.query(*dimensions, *_sum_columns()).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    )
    return query.group_by(*dimensions) if dimensions else query


def _unit_cost_sums(session: Session, restaurant_id: UUID,
                    d_from: date, d_to: date) -> dict[str, dict]:
    """Факты по юнитам; все четыре ключа присутствуют всегда (нулевые тоже)."""
    sums = {key: _zero_sums() for key in UNIT_KEYS}
    rows = _cost_rows(session, restaurant_id, d_from, d_to, DishSale.top_group)
    for top_group, revenue, cost, rwc in rows:
        unit = sums[resolve_unit(top_group)]
        unit['revenue'] += float(revenue)
        unit['cost'] += float(cost)
        unit['revenueWithCost'] += float(rwc)
    return sums


def _group_cost_sums(session: Session, restaurant_id: UUID,
                     d_from: date, d_to: date) -> dict[tuple, dict]:
    """Факты по группам (живой разрез): ключ (unit, имя группы)."""
    sums: dict[tuple, dict] = {}
    rows = _cost_rows(session, restaurant_id, d_from, d_to,
                      DishSale.top_group, DishSale.dish_group)
    for top_group, group, revenue, cost, rwc in rows:
        entry = sums.setdefault((resolve_unit(top_group), group), _zero_sums())
        entry['revenue'] += float(revenue)
        entry['cost'] += float(cost)
        entry['revenueWithCost'] += float(rwc)
    return sums


def _discount_sums(session: Session, restaurant_id: UUID,
                   d_from: date, d_to: date) -> dict:
    """Пять чисел блока discounts (только текущий период — по схеме)."""
    discounted = (DishSale.paid_sum > 0) & (func.coalesce(DishSale.discount, 0) > 0)
    discounted_costed = discounted & (func.coalesce(DishSale.cost, 0) > 0)
    row = session.query(
        func.coalesce(func.sum(case((discounted, DishSale.discount), else_=0)), 0),
        func.coalesce(func.sum(case((discounted, DishSale.paid_sum), else_=0)), 0),
        func.coalesce(func.sum(case((discounted_costed, DishSale.paid_sum), else_=0)), 0),
        func.coalesce(func.sum(case((discounted_costed, DishSale.discount), else_=0)), 0),
        func.coalesce(func.sum(case((discounted_costed, DishSale.cost), else_=0)), 0),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).one()
    return {
        'discountSum': round(float(row[0])),
        'discountedRevenue': round(float(row[1])),
        'discountedRevenueWithCost': round(float(row[2])),
        'discountSumWithCost': round(float(row[3])),
        'discountedCost': round(float(row[4])),
    }


def _compliment_sums(session: Session, restaurant_id: UUID,
                     d_from: date, d_to: date) -> dict:
    """Комплименты/представительские: paid = 0, price > 0."""
    cost, price_value, qty = session.query(
        func.coalesce(func.sum(func.coalesce(DishSale.cost, 0)), 0),
        func.coalesce(func.sum(DishSale.price), 0),
        func.coalesce(func.sum(DishSale.amount), 0),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        DishSale.paid_sum == 0,
        DishSale.price > 0,
    ).one()
    return {'cost': round(float(cost)),
            'priceValue': round(float(price_value)),
            'qty': round(float(qty), 2)}       # порций, дробное у весовых


def _staff_sums() -> dict:
    """TODO(staff): нули до решения по staff-механике (карточка №9)."""
    return {'cost': 0.0, 'paidSum': 0.0, 'qty': 0.0}


def _has_paid_orders(session: Session, restaurant_id: UUID,
                     d_from: date, d_to: date) -> bool:
    """«Сравнивать не с чем» = в периоде нет ни одного платного чека."""
    return session.query(Order.id).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).first() is not None


# --------------------------------------------------------------------------
# сборка
# --------------------------------------------------------------------------

def _fold(units: dict[str, dict]) -> dict:
    """Тоталы страницы = сумма юнитов: консистентность гарантирована арифметикой."""
    return {key: sum(u[key] for u in units.values())
            for key in ('revenue', 'cost', 'revenueWithCost')}


def _facts(cur: dict, prev: dict | None) -> dict:
    """Поля BaseCost: факты периода + prev* (None — сравнивать не с чем)."""
    return {
        'revenue': round(cur['revenue']),
        'cost': round(cur['cost']),
        'revenueWithCost': round(cur['revenueWithCost']),
        'prevRevenue': round(prev['revenue']) if prev is not None else None,
        'prevCost': round(prev['cost']) if prev is not None else None,
        'prevRevenueWithCost': round(prev['revenueWithCost']) if prev is not None else None,
    }


def build_food_cost(session: Session, restaurant_id: UUID,
                   year: int | None = None, month: int | None = None) -> Foodcost:
    d_from, d_to, _earliest, _latest = _resolve_dashboard_period(
        session, restaurant_id, year=year, month=month)
    p_from, p_to = _previous_period(d_from, d_to)

    units = _unit_cost_sums(session, restaurant_id, d_from, d_to)
    groups = _group_cost_sums(session, restaurant_id, d_from, d_to)

    # None — в compare-периоде нет ни одного платного чека (новый ресторан)
    has_prev = _has_paid_orders(session, restaurant_id, p_from, p_to)
    prev_units = _unit_cost_sums(session, restaurant_id, p_from, p_to) if has_prev else None
    prev_groups = _group_cost_sums(session, restaurant_id, p_from, p_to) if has_prev else None

    groups_payload = [
        {'unit': unit, 'group': group,
         **_facts(cur,
                  (prev_groups.get((unit, group), _zero_sums())
                   if has_prev else None))}
        # только группы с продажами в period; порядок — по выручке,
        # для детерминизма ответа (фронт волен пересортировать)
        for (unit, group), cur in sorted(groups.items(),
                                         key=lambda kv: -kv[1]['revenue'])
        if cur['revenue'] > 0
    ]

    # model_validate на выходе: опечатка в ключе или дыра в структуре
    # ловится юнит-тестом на сборке, а не на HTTP-запросе.
    return Foodcost.model_validate({
        'period': _period_dict(d_from, d_to),
        'compare': _period_dict(p_from, p_to),
        'totals': {**_facts(_fold(units), _fold(prev_units) if has_prev else None),
                   'goal': None},                     # до модуля targets
        'dirty': None,                                # фаза 2 (writeoffs)
        'units': [{'key': key,
                   **_facts(units[key],
                            prev_units[key] if has_prev else None)}
                  for key in UNIT_KEYS],
        'groups': groups_payload,
        'discounts': _discount_sums(session, restaurant_id, d_from, d_to),
        'losses': {
            'compliments': _compliment_sums(session, restaurant_id, d_from, d_to),
            'staff': _staff_sums(),
            'writeoffs': None,                        # фаза 2
        },
    })