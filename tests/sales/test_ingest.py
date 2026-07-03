"""Тесты загрузки продаж: валидация схемой, find-or-create заказа,
схлопывание сплит-оплат."""

import pytest
from pydantic import ValidationError

from src.database import DataBaseManager, Base
from src.sales.models import Order, DishSale
from src.sales.schemas import SaleRecord
from src.sales.service import ingest_records, parse_records

RAW = {
    'DiscountSum': 0,
    'DishCategory': 'Прочее',
    'DishGroup': 'Прочее',
    'DishGroup.TopParent': 'Кухня',
    'DishName': 'Контейнер',
    'DishSumInt': 25,
    'DishDiscountSumInt': 25,
    'DishAmountInt': 1,
    'GuestNum': 2,
    'ItemSaleEvent.Id': '918f62e8-71dc-4a3b-86c0-3bc3699b985a',
    'OpenDate.Typed': '2026-06-22',
    'OrderNum': 15,
    'PayTypes.Group': 'CARD',
    'PayTypes': 'Optima POS',
    'OrderType': 'Обычный заказ',
    'ProductCostBase.ProductCost': 10.619,
    'SessionNum': 874,
}


@pytest.fixture()
def session():
    # Своя БД в памяти на каждый тест — тесты не видят друг друга и диск.
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    session = manager.get_session()
    yield session
    session.close()


def make_raw(**overrides) -> dict:
    return {**RAW, **overrides}


def test_parse_converts_types():
    rec = parse_records([RAW])[0]
    assert rec.day.year == 2026          # строка стала datetime.date
    assert str(rec.id).startswith('918f')  # строка стала UUID
    assert rec.pay_type == 'CARD'
    assert rec.paid_sum == 25


def test_parse_rejects_bad_record():
    with pytest.raises(ValidationError):
        parse_records([make_raw(**{'OpenDate.Typed': 'не дата'})])


def test_dishes_of_same_order_share_one_order(session):
    records = parse_records([
        RAW,
        make_raw(**{
            'ItemSaleEvent.Id': '11111111-2222-3333-4444-555555555555',
            'DishName': 'Паста',
            'DishSumInt': 720,
            'DishDiscountSumInt': 720,
        }),
    ])
    ingest_records(session, records)
    session.commit()

    assert session.query(Order).count() == 1
    assert session.query(DishSale).count() == 2
    order = session.query(Order).one()
    assert {d.name for d in order.dish_sales} == {'Контейнер', 'Паста'}
    assert order.pay_type == 'CARD'
    assert order.order_type == 'Обычный заказ'


def test_split_payment_rows_merge_into_one_dish(session):
    # Сплит: одно блюдо за 5760, оплачено 1265.27 наличными + 4494.73 картой —
    # iiko отдаёт две строки с одним ItemSaleEvent.Id.
    records = parse_records([
        make_raw(**{'DishSumInt': 1265.27, 'DishDiscountSumInt': 1265.27,
                    'DishAmountInt': 0.22,
                    'PayTypes.Group': 'CASH', 'PayTypes': 'Наличные'}),
        make_raw(**{'DishSumInt': 4494.73, 'DishDiscountSumInt': 4494.73,
                    'DishAmountInt': 0.78,
                    'PayTypes.Group': 'CARD', 'PayTypes': 'Optima POS'}),
    ])
    ingest_records(session, records)
    session.commit()

    dish = session.query(DishSale).one()          # блюдо одно, не два
    assert float(dish.paid_sum) == 5760.0         # суммы частей сложились
    assert float(dish.amount) == 1.0              # и порции: 0.22 + 0.78
    order = session.query(Order).one()
    assert order.pay_type == 'MIXED'              # чек помечен как сплит
    assert order.pay_type_name == 'MIXED'


def test_existing_order_reused_on_second_batch(session):
    ingest_records(session, parse_records([RAW]))
    session.commit()

    ingest_records(session, parse_records([make_raw(**{
        'ItemSaleEvent.Id': '99999999-8888-7777-6666-555555555555',
        'DishName': 'Стейк',
    })]))
    session.commit()

    assert session.query(Order).count() == 1   # заказ не задвоился
    assert session.query(DishSale).count() == 2
