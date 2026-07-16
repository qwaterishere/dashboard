"""Сборка данных страницы «Склад»

Читает ежедневные слепки stock_balances (их пишет warehouse_sync) —
живой iiko на чтении не трогается. Правило «минус не в тотал»:
минусовая строка = qty < 0 (знак смотрим только по qty — цена
не бывает отрицательной ни в iiko, ни у нас); totals и dynamics считают только
положительные строки, positions отдаёт слепок целиком (включая минус),
negativeStock — готовое предупреждение по минусу.
Производные (цена = value/qty, доли, тренд) — зона фронтенда.
"""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.warehouse import StockBalance
from src.schemas.warehouse import Warehouse

UNIT_KEYS = ('k', 'b', 'w')
DYNAMICS_DEFAULT_DAYS = 30


class SnapshotNotFound(LookupError):
    """Слепка на запрошенную дату нет (или слепков нет вовсе) -> 404 в роутере."""


def _available_days(session: Session, restaurant_id: UUID) -> list[date]:
    """Дни, за которые есть слепок: кормит day-picker и валидацию ?date."""
    rows = session.query(StockBalance.day).filter(
        StockBalance.restaurant_id == restaurant_id,
    ).distinct().order_by(StockBalance.day).all()
    return [day for (day,) in rows]


def _snapshot_rows(session: Session, restaurant_id: UUID,
                   day: date) -> list[StockBalance]:
    """Полный слепок одного дня — один запрос; из него собираются
    positions, totals и negativeStock."""
    return session.query(StockBalance).filter(
        StockBalance.restaurant_id == restaurant_id,
        StockBalance.day == day,
    ).order_by(StockBalance.value.desc()).all()


def _dynamics(session: Session, restaurant_id: UUID,
              d_from: date, d_to: date) -> list[dict]:
    """Точки графика: SUM(value) положительных строк по (день, юнит).
    День без слепка точки не даёт: дыра в линии честнее нуля."""
    rows = session.query(
        StockBalance.day, StockBalance.store_unit,
        func.sum(StockBalance.value),
    ).filter(
        StockBalance.restaurant_id == restaurant_id,
        StockBalance.day.between(d_from, d_to),
        StockBalance.qty > 0,
    ).group_by(StockBalance.day, StockBalance.store_unit).all()

    by_day: dict[date, dict[str, float]] = {}
    for day, unit, value in rows:
        by_day.setdefault(day, dict.fromkeys(UNIT_KEYS, 0.0))[unit] = float(value)
    return [
        {'date': day,
         'byStore': [{'key': key, 'value': round(units[key])} for key in UNIT_KEYS]}
        for day, units in sorted(by_day.items())
    ]


def build_warehouse(session: Session, restaurant_id: UUID,
                    on_date: date | None = None,
                    dyn_from: date | None = None,
                    dyn_to: date | None = None) -> Warehouse:
    days = _available_days(session, restaurant_id)
    if not days:
        raise SnapshotNotFound('слепков остатков нет — склад ещё не синкался')

    as_of = on_date or days[-1]
    if as_of not in days:
        raise SnapshotNotFound(f'нет слепка склада за {as_of}')

    rows = _snapshot_rows(session, restaurant_id, as_of)

    totals = dict.fromkeys(UNIT_KEYS, 0.0)
    neg_count, neg_value = 0, 0.0
    for row in rows:
        if row.qty > 0:
            totals[row.store_unit] += float(row.value)
        elif row.qty < 0:
            neg_count += 1
            neg_value += abs(float(row.value))

    d_to = dyn_to or as_of
    d_from = dyn_from or d_to - timedelta(days=DYNAMICS_DEFAULT_DAYS)

    # model_validate на выходе: дыра в структуре ловится тестом на сборке
    return Warehouse.model_validate({
        'asOf': as_of,
        'dataBounds': {'earliest': days[0], 'latest': days[-1],
                       'availableDates': days},
        'totals': [{'key': key, 'value': round(totals[key])}
                   for key in UNIT_KEYS],
        'positions': [
            {'productId': str(row.product_id), 'name': row.product_name,
             'category': row.category, 'store': row.store_unit,
             'qty': round(float(row.qty), 3), 'unit': row.unit_name,
             'value': round(float(row.value), 2)}
            for row in rows
        ],
        'negativeStock': {'count': neg_count, 'valueAbs': round(neg_value, 2)},
        'dynamics': _dynamics(session, restaurant_id, d_from, d_to),
    })