"""Бизнес-логика домена sales: загрузка продаж в БД.

Одна запись = одна реализация блюда (SaleRecord). Поля заказа повторяются
у всех блюд одного чека, поэтому заказ ищем-или-создаём (find-or-create),
а блюдо привязываем к нему через ORM-связь.

Граница валидации: сырые dict из выгрузки превращаются в SaleRecord
(src/sales/schemas.py) ДО попадания сюда — сервис работает уже
с проверенными типами.
"""
from sqlalchemy.orm import Session

from src.sales.models import Order, DishSale
from src.sales.schemas import SaleRecord


def parse_records(raw_records: list[dict]) -> list[SaleRecord]:
    """Валидирует сырые записи выгрузки. Кривая запись -> ValidationError."""
    return [SaleRecord.model_validate(raw) for raw in raw_records]


def ingest_records(session: Session, records: list[SaleRecord]) -> None:
    """Загружает провалидированные записи в переданную сессию.

    Коммит/роллбэк оставлены вызывающему коду — так функцию можно
    использовать и внутри более крупной транзакции.
    """
    # Кэш уже созданных/найденных заказов в рамках этой пачки,
    # чтобы не ходить в БД на каждую строку одного и того же чека.
    orders_cache: dict[tuple, Order] = {}

    for rec in records:
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
                    pay_type=rec.pay_type,
                )
                session.add(order)
            orders_cache[key] = order

        dish = DishSale(
            id=rec.id,
            name=rec.name,
            cost=rec.cost,
            price=rec.price,
            discount=rec.discount,
            dish_category=rec.dish_category,
            dish_group=rec.dish_group,
        )
        # ORM-способ: присваиваем объект, а не order_id.
        # SQLAlchemy сам проставит внешний ключ при flush/commit.
        order.dish_sales.append(dish)

    session.flush()
