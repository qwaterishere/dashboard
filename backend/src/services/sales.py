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
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.domain.constants import CAT_OTHER, resolve_unit
from src.db.models.sales import Order, DishSale
from src.schemas.sales import SaleRecord, SalesPage, SalesPosition, Period

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
            seen.amount += rec.amount
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


def ingest_records(
    session: Session,
    records: list[SaleRecord],
    *,
    restaurant_id: UUID,
) -> None:
    """Загружает провалидированные записи в переданную сессию.

    Коммит/роллбэк оставлены вызывающему коду — так функцию можно
    использовать и внутри более крупной транзакции.
    """
    # --- проход 1: агрегация -------------------------------------------
    # Способы оплаты чека собираем ДО схлопывания: сплит виден только
    # по исходным строкам. Здесь же — оплаченная сумма каждого чека.
    order_pay_types: dict[tuple, set] = {}
    order_pay_names: dict[tuple, set] = {}
    order_paid: dict[tuple, Decimal] = {}
    for rec in records:
        key = (rec.order_number, rec.session_number, rec.day)
        order_pay_types.setdefault(key, set()).add(rec.pay_type)
        order_pay_names.setdefault(key, set()).add(rec.pay_type_name)
        order_paid[key] = order_paid.get(key, Decimal(0)) + rec.paid_sum

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
                restaurant_id=restaurant_id,
                order_number=rec.order_number,
                session_number=rec.session_number,
                day=rec.day,
            ).first()
            if order is None:
                order = Order(
                    restaurant_id=restaurant_id,
                    order_number=rec.order_number,
                    session_number=rec.session_number,
                    day=rec.day,
                    guests_number=rec.guests_number,
                    paid_total=order_paid[key],
                    pay_type=_resolve_pay_field(order_pay_types[key]),
                    pay_type_name=_resolve_pay_field(order_pay_names[key]),
                    order_type=rec.order_type,
                )
                session.add(order)
            else:
                # заказ уже в БД с прошлой пачки — новые блюда дополняют сумму
                order.paid_total = order.paid_total + order_paid[key]
            orders_cache[key] = order

        dish = DishSale(
            id=rec.id,
            name=rec.name,
            cost=rec.cost,
            price=rec.price,
            paid_sum=rec.paid_sum,
            amount=rec.amount,
            discount=rec.discount,
            dish_category=rec.dish_category,
            dish_group=rec.dish_group,
            top_group=rec.top_group,
        )
        # ORM-способ: присваиваем объект, а не order_id.
        # SQLAlchemy сам проставит внешний ключ при flush/commit.
        order.dish_sales.append(dish)

    session.flush()


def replace_day(
    session: Session,
    day: date,
    records: list[SaleRecord],
    *,
    restaurant_id: UUID,
) -> None:
    """Идемпотентная загрузка дня: данные дня удаляются и вставляются заново.

    Повторный запуск не создаёт дублей и подхватывает изменения задним
    числом (сторно, правки в iiko). Коммит — на вызывающем коде.
    """
    day_records = [r for r in records if r.day == day]

    # ItemSaleEvent.Id глобально уникален в iiko. После миграции на multi-tenant
    # в БД могли остаться блюда без restaurant_id на заказе — их replace_day
    # раньше не трогал, и INSERT падал с UNIQUE constraint failed: dish_sales.id.
    incoming_ids = {r.id for r in day_records}
    if incoming_ids:
        session.query(DishSale).filter(DishSale.id.in_(incoming_ids)).delete(
            synchronize_session=False,
        )

    order_ids = [
        oid
        for (oid,) in session.query(Order.id).filter(
            Order.day == day,
            (Order.restaurant_id == restaurant_id) | (Order.restaurant_id.is_(None)),
        )
    ]
    if order_ids:
        session.query(DishSale).filter(DishSale.order_id.in_(order_ids)).delete(
            synchronize_session=False,
        )
        session.query(Order).filter(Order.id.in_(order_ids)).delete(
            synchronize_session=False,
        )

    ingest_records(session, day_records, restaurant_id=restaurant_id)


def build_sales(
    session: Session,
    restaurant_id: UUID,
    date_from: date | None = None,
    date_to: date | None = None,
) -> SalesPage:
    """Страница «Продажи»: агрегат по позициям в структуре data/sales.json.

    Без параметров берётся весь период, что есть в БД.
    qty = сумма порций (дробное у весовых блюд), price/unitCost — средняя
    фактическая цена и себестоимость ПОРЦИИ; фронтенд восстанавливает
    rev = qty*price = фактическая выручка.
    """
    if date_from is None:
        date_from = session.query(func.min(Order.day)).filter(
            Order.restaurant_id == restaurant_id,
        ).scalar()
    if date_to is None:
        date_to = session.query(func.max(Order.day)).filter(
            Order.restaurant_id == restaurant_id,
        ).scalar()
    if date_from is None:   # пустая база
        return SalesPage(period=Period(label='Нет данных', note=''), positions=[])

    rows = (
        session.query(
            DishSale.name,
            func.max(DishSale.dish_category),
            func.max(DishSale.top_group),
            func.sum(DishSale.amount),
            func.sum(DishSale.paid_sum),
            func.sum(func.coalesce(DishSale.cost, 0)),
        )
        .join(Order)
        .filter(
            Order.restaurant_id == restaurant_id,
            Order.day >= date_from,
            Order.day <= date_to,
        )
        # Бесплатные строки (комплименты, проработки, включённые в банкет)
        # не входят в продажные qty и средние цены — они не продажи.
        # Построчный фильтр строже прежнего HAVING: у блюда, проданного
        # и за деньги, и комплиментом, в qty идут только платные порции.
        .filter(DishSale.paid_sum > 0)
        .group_by(DishSale.name)
        .all()
    )

    positions = [
        SalesPosition(
            name=name,
            sub=category,
            # юнит = папка 1-го уровня в iiko; вне папок -> «вне подразделений»
            cat=resolve_unit(top_group),
            # UNIT_BY_TOP_GROUP.get(top_group, CAT_OTHER),
            qty=round(float(qty), 2),
            price=round(float(paid) / float(qty), 2),
            unitCost=round(float(cost) / float(qty), 2),
        )
        for name, category, top_group, qty, paid, cost in rows
    ]
    period = Period(
        label=f'{date_from:%d.%m} — {date_to:%d.%m.%Y}',
        note='реальные данные iiko',
    )
    return SalesPage(period=period, positions=positions)
