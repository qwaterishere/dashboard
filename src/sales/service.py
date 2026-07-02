"""Бизнес-логика домена sales: загрузка продаж в БД.

Одна запись = одна реализация блюда (SaleRecord), НО при сплит-оплате
(чек закрыт частично картой, частично наличными) iiko отдаёт одно блюдо
НЕСКОЛЬКИМИ строками с одним ItemSaleEvent.Id — суммы разделены
пропорционально долям оплат. Поэтому загрузка идёт в два прохода:

1) агрегация: строки одного блюда схлопываются (суммы складываются),
   по каждому чеку собираются все встреченные способы оплаты;
2) запись: заказ ищем-или-создаём (find-or-create), блюдо привязываем
   через ORM-связь.

Граница валидации: сырые dict превращаются в SaleRecord
(src/sales/schemas.py) ДО попадания сюда.
"""
from datetime import date
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.sales.constants import resolve_cat
from src.sales.models import Order, DishSale
from src.sales.schemas import SaleRecord, SalesPage, SalesPosition, Period


def parse_records(raw_records: list[dict]) -> list[SaleRecord]:
    """Валидирует сырые записи выгрузки. Кривая запись -> ValidationError."""
    return [SaleRecord.model_validate(raw) for raw in raw_records]


def _merge_split_payments(records: list[SaleRecord]) -> list[SaleRecord]:
    """Схлопывает строки одного блюда, размноженные сплит-оплатой.

    Денежные поля складываются (iiko делит их пропорционально оплатам,
    сумма частей = целое). Остальные поля у частей одинаковы — берутся
    из первой строки.
    """
    merged: dict[UUID, SaleRecord] = {}
    for rec in records:
        seen = merged.get(rec.id)
        if seen is None:
            merged[rec.id] = rec
        else:
            seen.price += rec.price
            seen.paid_sum += rec.paid_sum
            if rec.discount is not None:
                seen.discount = (seen.discount or 0) + rec.discount
            if rec.cost is not None:
                seen.cost = (seen.cost or 0) + rec.cost
    return list(merged.values())


def _resolve_pay_field(values: set[str | None]) -> str | None:
    """Способ оплаты чека по способам его строк.

    Один способ -> он и есть; несколько -> 'MIXED' (сплит);
    только None -> None (чек без оплаты, комплимент).
    """
    real = {v for v in values if v is not None}
    if len(real) > 1:
        return 'MIXED'
    return real.pop() if real else None


def ingest_records(session: Session, records: list[SaleRecord]) -> None:
    """Загружает провалидированные записи в переданную сессию.

    Коммит/роллбэк оставлены вызывающему коду — так функцию можно
    использовать и внутри более крупной транзакции.
    """
    # --- проход 1: агрегация -------------------------------------------
    # Способы оплаты чека собираем ДО схлопывания: сплит виден только
    # по исходным строкам.
    order_pay_types: dict[tuple, set] = {}
    order_pay_names: dict[tuple, set] = {}
    for rec in records:
        key = (rec.order_number, rec.session_number, rec.day)
        order_pay_types.setdefault(key, set()).add(rec.pay_type)
        order_pay_names.setdefault(key, set()).add(rec.pay_type_name)

    dishes = _merge_split_payments(records)

    # --- проход 2: запись ----------------------------------------------
    # Кэш заказов пачки: блюда одного чека должны попасть в один объект,
    # а свежесозданный заказ ещё не находится запросом в БД.
    orders_cache: dict[tuple, Order] = {}

    for rec in dishes:
        key = (rec.order_number, rec.session_number, rec.day)

        order = orders_cache.get(key)
        if order is None:
            order = session.query(Order).filter_by(
                order_number=rec.order_number,
                session_number=rec.session_number,
                day=rec.day,
            ).first()
            if order is None:
                order = Order(
                    order_number=rec.order_number,
                    session_number=rec.session_number,
                    day=rec.day,
                    guests_number=rec.guests_number,
                    pay_type=_resolve_pay_field(order_pay_types[key]),
                    pay_type_name=_resolve_pay_field(order_pay_names[key]),
                    order_type=rec.order_type,
                )
                session.add(order)
            orders_cache[key] = order

        dish = DishSale(
            id=rec.id,
            name=rec.name,
            cost=rec.cost,
            price=rec.price,
            paid_sum=rec.paid_sum,
            discount=rec.discount,
            dish_category=rec.dish_category,
            dish_group=rec.dish_group,
        )
        # ORM-способ: присваиваем объект, а не order_id.
        # SQLAlchemy сам проставит внешний ключ при flush/commit.
        order.dish_sales.append(dish)

    session.flush()


def build_sales(session: Session,
                date_from: date | None = None,
                date_to: date | None = None) -> SalesPage:
    """Страница «Продажи»: агрегат по позициям в структуре data/sales.json.

    Без параметров берётся весь период, что есть в БД. qty пока считается
    по строкам продаж (одна строка может содержать несколько порций —
    для точного qty нужен DishAmountInt из iiko); суммы при этом точные:
    price/unitCost — средние на строку, фронтенд восстанавливает
    rev = qty*price = фактическая выручка.
    """
    if date_from is None:
        date_from = session.query(func.min(Order.day)).scalar()
    if date_to is None:
        date_to = session.query(func.max(Order.day)).scalar()
    if date_from is None:   # пустая база
        return SalesPage(period=Period(label='Нет данных', note=''), positions=[])

    rows = (
        session.query(
            DishSale.name,
            func.max(DishSale.dish_category),
            func.count(DishSale.id),
            func.sum(DishSale.paid_sum),
            func.sum(func.coalesce(DishSale.cost, 0)),
        )
        .join(Order)
        .filter(Order.day >= date_from, Order.day <= date_to)
        .group_by(DishSale.name)
        # Нулевые позиции (проработки, банкетные включённые блюда) —
        # не продажи; фронтенд на rev=0 делит на ноль в фудкосте.
        .having(func.sum(DishSale.paid_sum) > 0)
        .all()
    )

    positions = [
        SalesPosition(
            name=name,
            sub=category,
            cat=resolve_cat(category),
            qty=qty,
            price=round(float(paid) / qty, 2),
            unitCost=round(float(cost) / qty, 2),
        )
        for name, category, qty, paid, cost in rows
    ]
    period = Period(
        label=f'{date_from:%d.%m} — {date_to:%d.%m.%Y}',
        note='реальные данные iiko',
    )
    return SalesPage(period=period, positions=positions)
