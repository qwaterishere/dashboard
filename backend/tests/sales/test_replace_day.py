"""Тесты идемпотентной перезагрузки дня (ядро загрузчика)."""

from datetime import date

import pytest

from src.db.session import DataBaseManager, Base
from src.db.models.sales import Order, DishSale
from src.services.sales import parse_records, replace_day
from tests.factories import create_restaurant
from tests.sales.test_ingest import RAW, make_raw

DAY = date(2026, 6, 22)   # день из RAW


@pytest.fixture()
def session():
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    session = manager.get_session()
    yield session
    session.close()


@pytest.fixture()
def restaurant(session):
    return create_restaurant(session)


def test_repeat_load_is_idempotent(session, restaurant):
    records = parse_records([RAW])

    replace_day(session, DAY, records, restaurant_id=restaurant.id)
    session.commit()
    replace_day(session, DAY, records, restaurant_id=restaurant.id)
    session.commit()

    assert session.query(Order).count() == 1
    assert session.query(DishSale).count() == 1


def test_reload_replaces_stale_data(session, restaurant):
    replace_day(session, DAY, parse_records([RAW]), restaurant_id=restaurant.id)
    session.commit()

    new = parse_records([make_raw(**{
        'ItemSaleEvent.Id': '99999999-8888-7777-6666-555555555555',
        'DishName': 'Стейк',
    })])
    replace_day(session, DAY, new, restaurant_id=restaurant.id)
    session.commit()

    dishes = session.query(DishSale).all()
    assert [d.name for d in dishes] == ['Стейк']


def test_only_given_day_is_touched(session, restaurant):
    replace_day(session, DAY, parse_records([RAW]), restaurant_id=restaurant.id)
    other_day_raw = make_raw(**{
        'ItemSaleEvent.Id': '11111111-2222-3333-4444-555555555555',
        'OpenDate.Typed': '2026-06-23', 'SessionNum': 875,
    })
    replace_day(
        session,
        date(2026, 6, 23),
        parse_records([other_day_raw]),
        restaurant_id=restaurant.id,
    )
    session.commit()

    replace_day(
        session,
        DAY,
        parse_records([RAW, other_day_raw]),
        restaurant_id=restaurant.id,
    )
    session.commit()

    assert session.query(Order).count() == 2
    assert session.query(DishSale).count() == 2


def test_replace_day_overwrites_legacy_orphan_dishes(session, restaurant):
    """Данные до multi-tenant (restaurant_id IS NULL) не блокируют повторную загрузку."""
    records = parse_records([RAW])
    dish_id = records[0].id

    legacy_order = Order(
        order_number=RAW['OrderNum'],
        session_number=RAW['SessionNum'],
        day=DAY,
        guests_number=RAW['GuestNum'],
        paid_total=25,
        restaurant_id=None,
    )
    session.add(legacy_order)
    session.flush()
    session.add(
        DishSale(
            id=dish_id,
            name='Старое блюдо',
            cost=10,
            price=25,
            paid_sum=25,
            amount=1,
            discount=0,
            dish_category='Прочее',
            dish_group='Прочее',
            top_group='Кухня',
            order_id=legacy_order.id,
        )
    )
    session.commit()

    replace_day(session, DAY, records, restaurant_id=restaurant.id)
    session.commit()

    dish = session.query(DishSale).one()
    assert dish.id == dish_id
    assert dish.name == RAW['DishName']
    assert session.query(Order).one().restaurant_id == restaurant.id
