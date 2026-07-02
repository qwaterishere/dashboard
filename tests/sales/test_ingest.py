"""Тесты загрузки продаж: валидация схемой + find-or-create заказа."""

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
    'DishName': 'Контейнер',
    'DishSumInt': 25,
    'GuestNum': 2,
    'ItemSaleEvent.Id': '918f62e8-71dc-4a3b-86c0-3bc3699b985a',
    'OpenDate.Typed': '2026-06-22',
    'OrderNum': 15,
    'PayTypes.Group': 'CARD',
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
        }),
    ])
    ingest_records(session, records)
    session.commit()

    assert session.query(Order).count() == 1
    assert session.query(DishSale).count() == 2
    order = session.query(Order).one()
    assert {d.name for d in order.dish_sales} == {'Контейнер', 'Паста'}


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
