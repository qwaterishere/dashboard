"""Планирование диапазона iiko sync."""

from datetime import date

import pytest

from src.db.session import DataBaseManager, Base
from src.services.iiko_sync import history_limit, resolve_sync_plan
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw
from src.services.sales import ingest_records, parse_records


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


def _load_day(session, restaurant, day: str):
    raw = make_raw(**{
        'ItemSaleEvent.Id': '11111111-0000-0000-0000-000000000001',
        'OpenDate.Typed': day,
        'OrderNum': 1,
        'SessionNum': 900,
        'DishSumInt': 1000,
        'DishDiscountSumInt': 1000,
        'ProductCostBase.ProductCost': 300,
        'DishGroup.TopParent': 'Кухня',
        'DishGroup': 'Горячее',
    })
    ingest_records(session, parse_records([raw]), restaurant_id=restaurant.id)
    session.commit()


import datetime as dt


def _patch_today(monkeypatch, fixed: date) -> None:
    class FakeDate(dt.date):
        @classmethod
        def today(cls):
            return fixed

    monkeypatch.setattr('src.services.iiko_sync.date', FakeDate)


def test_resolve_sync_plan_incremental_when_data_exists(session, restaurant, monkeypatch):
    """Regression: incremental plan must not raise when last day is in DB."""
    _patch_today(monkeypatch, date(2026, 6, 15))
    _load_day(session, restaurant, '2026-06-10')

    plan = resolve_sync_plan(session, restaurant.id, full=False)
    assert plan is not None
    assert plan.date_from == date(2026, 6, 10)


def test_resolve_sync_plan_incremental_from_last_day(session, restaurant, monkeypatch):
    _patch_today(monkeypatch, date(2026, 6, 15))
    _load_day(session, restaurant, '2026-06-10')

    plan = resolve_sync_plan(session, restaurant.id)
    assert plan is not None
    assert plan.date_from == date(2026, 6, 10)
    assert plan.date_to == date(2026, 6, 14)


def test_resolve_sync_plan_full_ignores_last_day(session, restaurant, monkeypatch):
    _patch_today(monkeypatch, date(2026, 6, 15))
    _load_day(session, restaurant, '2026-06-10')

    plan = resolve_sync_plan(session, restaurant.id, full=True)
    assert plan is not None
    assert plan.date_from == history_limit(date(2026, 6, 15))
    assert plan.date_to == date(2026, 6, 14)
