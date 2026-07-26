"""Сборка данных ресурса «Склад» (/api/stock/*).

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
from src.schemas.stock import (
    DynamicsPoint,
    NegativeStock,
    StockPosition,
    StockSnapshot,
    StoreValue,
)
from src.services.analytics.money import money_float

UNIT_KEYS = ('k', 'b', 'w')
DYNAMICS_DEFAULT_DAYS = 30


class SnapshotNotFound(LookupError):
    """Слепка на запрошенную дату нет (или слепков нет вовсе) -> 404 в роутере."""


def stock_available_days(session: Session, restaurant_id: UUID) -> list[date]:
    """Дни, за которые есть слепок: кормит day-picker и валидацию ?date."""
    rows = session.query(StockBalance.day).filter(
        StockBalance.restaurant_id == restaurant_id,
    ).distinct().order_by(StockBalance.day).all()
    return [day for (day,) in rows]


def stock_snapshot_rows(
    session: Session, restaurant_id: UUID, day: date,
) -> list[StockBalance]:
    """Полный слепок одного дня — один запрос; из него собираются
    positions, totals и negativeStock."""
    return session.query(StockBalance).filter(
        StockBalance.restaurant_id == restaurant_id,
        StockBalance.day == day,
    ).order_by(StockBalance.value.desc()).all()


def stock_dynamics(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> list[DynamicsPoint]:
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
        by_day.setdefault(day, dict.fromkeys(UNIT_KEYS, 0.0))[unit] = money_float(value)
    return [
        DynamicsPoint.model_validate({
            'date': day,
            'byStore': [{'key': key, 'value': round(units[key])} for key in UNIT_KEYS],
        })
        for day, units in sorted(by_day.items())
    ]


def _resolve_as_of(
    session: Session, restaurant_id: UUID, on_date: date | None,
) -> tuple[list[date], date, list[StockBalance]]:
    days = stock_available_days(session, restaurant_id)
    if not days:
        raise SnapshotNotFound('слепков остатков нет — склад ещё не синкался')
    as_of = on_date or days[-1]
    if as_of not in days:
        raise SnapshotNotFound(f'нет слепка склада за {as_of}')
    return days, as_of, stock_snapshot_rows(session, restaurant_id, as_of)


def _totals_from_rows(rows: list[StockBalance]) -> list[StoreValue]:
    totals = dict.fromkeys(UNIT_KEYS, 0.0)
    for row in rows:
        if row.qty > 0:
            totals[row.store_unit] += money_float(row.value)
    return [
        StoreValue.model_validate({'key': key, 'value': round(totals[key])})
        for key in UNIT_KEYS
    ]


def _positions_from_rows(rows: list[StockBalance]) -> list[StockPosition]:
    return [
        StockPosition.model_validate({
            'productId': str(row.product_id),
            'name': row.product_name,
            'category': row.category,
            'store': row.store_unit,
            'qty': round(float(row.qty), 3),
            'unit': row.unit_name,
            'value': money_float(row.value),
        })
        for row in rows
    ]


def _negative_from_rows(rows: list[StockBalance]) -> NegativeStock:
    neg_count, neg_value = 0, 0.0
    for row in rows:
        if row.qty < 0:
            neg_count += 1
            neg_value += abs(money_float(row.value))
    return NegativeStock.model_validate({
        'count': neg_count, 'valueAbs': money_float(neg_value),
    })


def stock_totals(
    session: Session, restaurant_id: UUID, on_date: date | None = None,
) -> list[StoreValue]:
    _days, _as_of, rows = _resolve_as_of(session, restaurant_id, on_date)
    return _totals_from_rows(rows)


def stock_positions(
    session: Session, restaurant_id: UUID, on_date: date | None = None,
) -> list[StockPosition]:
    _days, _as_of, rows = _resolve_as_of(session, restaurant_id, on_date)
    return _positions_from_rows(rows)


def stock_negative(
    session: Session, restaurant_id: UUID, on_date: date | None = None,
) -> NegativeStock:
    _days, _as_of, rows = _resolve_as_of(session, restaurant_id, on_date)
    return _negative_from_rows(rows)


def stock_bounds(session: Session, restaurant_id: UUID) -> dict:
    days = stock_available_days(session, restaurant_id)
    if not days:
        raise SnapshotNotFound('слепков остатков нет — склад ещё не синкался')
    return {
        'earliest': days[0],
        'latest': days[-1],
        'available_dates': days,
    }


def stock_dynamics_range(
    session: Session,
    restaurant_id: UUID,
    *,
    on_date: date | None = None,
    dyn_from: date | None = None,
    dyn_to: date | None = None,
) -> list[DynamicsPoint]:
    days = stock_available_days(session, restaurant_id)
    if not days:
        raise SnapshotNotFound('слепков остатков нет — склад ещё не синкался')
    as_of = on_date or days[-1]
    if as_of not in days and on_date is not None:
        raise SnapshotNotFound(f'нет слепка склада за {as_of}')
    if as_of not in days:
        as_of = days[-1]
    d_to = dyn_to or as_of
    d_from = dyn_from or d_to - timedelta(days=DYNAMICS_DEFAULT_DAYS)
    return stock_dynamics(session, restaurant_id, d_from, d_to)


def build_stock_snapshot(
    session: Session,
    restaurant_id: UUID,
    on_date: date | None = None,
    dyn_from: date | None = None,
    dyn_to: date | None = None,
) -> StockSnapshot:
    """Полный снимок склада (totals + positions + dynamics)."""
    days, as_of, rows = _resolve_as_of(session, restaurant_id, on_date)
    d_to = dyn_to or as_of
    d_from = dyn_from or d_to - timedelta(days=DYNAMICS_DEFAULT_DAYS)
    return StockSnapshot(
        asOf=as_of,
        dataBounds={
            'earliest': days[0],
            'latest': days[-1],
            'availableDates': days,
        },
        totals=_totals_from_rows(rows),
        positions=_positions_from_rows(rows),
        negativeStock=_negative_from_rows(rows),
        dynamics=stock_dynamics(session, restaurant_id, d_from, d_to),
    )
