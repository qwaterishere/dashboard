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
                     d_from: date, d_to: date) -> dict[str, dict]:
    """Факты по группам (живой разрез). Ключ — group_id: склейка
    переименований папки (имя и юнит — из последней продажи периода);
    prev-период матчится тем же ключом — LfL группы переживает
    переименование. Строки без group_id (история до пересоздания
    базы) живут по имени."""
    rows = session.query(
        DishSale.group_id, DishSale.top_group, DishSale.dish_group,
        *_sum_columns(), func.max(Order.day),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(DishSale.group_id, DishSale.top_group,
               DishSale.dish_group).all()

    sums: dict[str, dict] = {}
    for group_id, top_group, group, revenue, cost, rwc, last_day in rows:
        entry = sums.setdefault(group_id.hex if group_id else f'name:{group}', {
            **_zero_sums(), 'unit': resolve_unit(top_group),
            'group': group, 'last_day': last_day,
        })
        entry['revenue'] += float(revenue)
        entry['cost'] += float(cost)
        entry['revenueWithCost'] += float(rwc)
        if last_day >= entry['last_day']:   # имя/юнит — из последней продажи
            entry.update(group=group, unit=resolve_unit(top_group),
                         last_day=last_day)
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


def _product_sums(session: Session, restaurant_id: UUID,
                  d_from: date, d_to: date) -> list[dict]:
    """Позиции диаграммы выгодности: ТОЛЬКО фудкост-строки (правило №3),
    поэтому revenue позиции здесь = её revenueWithCost. Идентичность —
    dish_id (склейка переименований: имя и юнит — из последней продажи
    периода);"""
    in_foodcost = (DishSale.paid_sum > 0) & (func.coalesce(DishSale.cost, 0) > 0)
    rows = session.query(
        DishSale.dish_id, DishSale.top_group, DishSale.name,
        func.sum(DishSale.paid_sum),
        func.sum(DishSale.cost),
        func.sum(DishSale.amount),
        func.max(Order.day),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        in_foodcost,
    ).group_by(DishSale.dish_id, DishSale.top_group, DishSale.name).all()

    sums: dict[str, dict] = {}
    for dish_id, top_group, name, revenue, cost, qty, last_day in rows:
        entry = sums.setdefault(dish_id.hex if dish_id else f'name:{name}', {
            'id': dish_id, 'name': name, 'unit': resolve_unit(top_group),
            'revenue': 0.0, 'cost': 0.0, 'qty': 0.0, 'last_day': last_day,
        })
        entry['revenue'] += float(revenue)
        entry['cost'] += float(cost)
        entry['qty'] += float(qty)
        if last_day >= entry['last_day']:   # имя/юнит — из последней продажи
            entry.update(name=name, unit=resolve_unit(top_group),
                         last_day=last_day)

    return [
        {'id': str(entry['id']) if entry['id'] else None,
         'name': entry['name'], 'unit': entry['unit'],
         'qty': round(entry['qty'], 2),
         'revenue': round(entry['revenue']),
         'cost': round(entry['cost'])}
        for entry in sorted(sums.values(), key=lambda e: -e['revenue'])
    ]


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

    # model_validate на выходе: опечатка в ключе или дыра в структуре
    # ловится юнит-тестом на сборке, а не на HTTP-запросе.
    from src.services.targets import load_foodcost_goals

    unit_revenues = {key: units[key]['revenue'] for key in UNIT_KEYS}
    goals = load_foodcost_goals(
        session,
        restaurant_id,
        d_from.year,
        d_from.month,
        unit_revenues=unit_revenues,
    )

    groups_payload = [
        {'unit': cur['unit'], 'group': cur['group'],
         **_facts(cur,
                  (prev_groups.get(key, _zero_sums())
                   if has_prev else None)),
         'goal': goals.unit_goal_pct.get(cur['unit'])}
        for key, cur in sorted(groups.items(),
                               key=lambda kv: -kv[1]['revenue'])
        if cur['revenue'] > 0
    ]

    return Foodcost.model_validate({
        'period': _period_dict(d_from, d_to),
        'compare': _period_dict(p_from, p_to),
        'totals': {**_facts(_fold(units), _fold(prev_units) if has_prev else None),
                   'goal': goals.totals_goal_pct},
        'dirty': None,                                # фаза 2 (writeoffs)
        'units': [{'key': key,
                   **_facts(units[key],
                            prev_units[key] if has_prev else None),
                   'goal': goals.unit_goal_pct.get(key)}
                  for key in UNIT_KEYS],
        'groups': groups_payload,
        'products': _product_sums(session, restaurant_id, d_from, d_to),
        'discounts': _discount_sums(session, restaurant_id, d_from, d_to),
        'losses': {
            'compliments': _compliment_sums(session, restaurant_id, d_from, d_to),
            'staff': _staff_sums(),
            'writeoffs': None,                        # фаза 2
            'writeoffsGoal': goals.writeoffs_goal_rub,
            'complimentsGoal': goals.compliments_goal_rub,
        },
    })