"""Custom compare period for dashboard LfL."""

from datetime import date

import pytest

from src.services.dashboard import build_dashboard
from src.db.session import DataBaseManager, Base
from src.services.sales import ingest_records, parse_records
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw


@pytest.fixture()
def session():
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    db = manager.get_session()
    yield db
    db.close()


@pytest.fixture()
def restaurant(session):
    return create_restaurant(session)


def _sale(day: str, order: int, uid: str, paid: float = 500):
    return make_raw(**{
        'ItemSaleEvent.Id': uid, 'OpenDate.Typed': day, 'OrderNum': order,
        'SessionNum': 900, 'GuestNum': 2,
        'DishSumInt': paid, 'DishDiscountSumInt': paid,
    })


def test_custom_compare_period(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
        _sale('2026-06-02', 2, 'aaaaaaaa-0000-0000-0000-000000000002', paid=500),
        _sale('2026-04-01', 3, 'bbbbbbbb-0000-0000-0000-000000000001', paid=200),
        _sale('2026-04-02', 4, 'bbbbbbbb-0000-0000-0000-000000000002', paid=100),
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(
        session,
        restaurant.id,
        compare_start=date(2026, 4, 1),
        compare_end=date(2026, 4, 2),
    )

    assert page.kpis.revenue.value == 1500
    assert page.kpis.revenue.prevValue == 300
    assert page.compare.year == 2026 and page.compare.month == 4
