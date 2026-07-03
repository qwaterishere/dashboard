"""Тесты идемпотентной перезагрузки дня (ядро загрузчика)."""

from datetime import date

import pytest

from src.database import DataBaseManager, Base
from src.sales.models import Order, DishSale
from src.sales.service import parse_records, replace_day
from tests.sales.test_ingest import RAW, make_raw

DAY = date(2026, 6, 22)   # день из RAW


@pytest.fixture()
def session():
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    session = manager.get_session()
    yield session
    session.close()


def test_repeat_load_is_idempotent(session):
    records = parse_records([RAW])

    replace_day(session, DAY, records)
    session.commit()
    replace_day(session, DAY, records)   # тот же день ещё раз — не падает на PK
    session.commit()

    assert session.query(Order).count() == 1
    assert session.query(DishSale).count() == 1


def test_reload_replaces_stale_data(session):
    replace_day(session, DAY, parse_records([RAW]))          # в дне был Контейнер
    session.commit()

    new = parse_records([make_raw(**{
        'ItemSaleEvent.Id': '99999999-8888-7777-6666-555555555555',
        'DishName': 'Стейк',
    })])
    replace_day(session, DAY, new)                           # перезагрузили день: теперь Стейк
    session.commit()

    dishes = session.query(DishSale).all()
    assert [d.name for d in dishes] == ['Стейк']             # старое блюдо не осталось


def test_only_given_day_is_touched(session):
    replace_day(session, DAY, parse_records([RAW]))
    other_day_raw = make_raw(**{
        'ItemSaleEvent.Id': '11111111-2222-3333-4444-555555555555',
        'OpenDate.Typed': '2026-06-23', 'SessionNum': 875,
    })
    replace_day(session, date(2026, 6, 23), parse_records([other_day_raw]))
    session.commit()

    # перезагрузка 22-го не трогает 23-е; запись чужого дня в пачке игнорируется
    replace_day(session, DAY, parse_records([RAW, other_day_raw]))
    session.commit()

    assert session.query(Order).count() == 2
    assert session.query(DishSale).count() == 2
