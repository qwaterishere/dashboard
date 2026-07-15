"""Lightweight KPI endpoint — totals + compare only."""

from datetime import date

import pytest

from src.services.dashboard import build_dashboard, build_dashboard_kpi
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


def test_kpi_matches_full_dashboard_kpis(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
        _sale('2026-06-02', 2, 'aaaaaaaa-0000-0000-0000-000000000002', paid=500),
        _sale('2026-05-01', 3, 'bbbbbbbb-0000-0000-0000-000000000001', paid=200),
        _sale('2026-05-02', 4, 'bbbbbbbb-0000-0000-0000-000000000002', paid=100),
    ]), restaurant_id=restaurant.id)
    session.commit()

    full = build_dashboard(
        session,
        restaurant.id,
        compare_start=date(2026, 5, 1),
        compare_end=date(2026, 5, 2),
    )
    kpi = build_dashboard_kpi(
        session,
        restaurant.id,
        compare_start=date(2026, 5, 1),
        compare_end=date(2026, 5, 2),
    )

    assert kpi.kpis.revenue.value == full.kpis.revenue.value
    assert kpi.kpis.revenue.prevValue == full.kpis.revenue.prevValue
    assert kpi.kpis.checks.value == full.kpis.checks.value
    assert kpi.compare == full.compare


def test_kpi_omits_chart_payload(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
    ]), restaurant_id=restaurant.id)
    session.commit()

    kpi = build_dashboard_kpi(session, restaurant.id)
    dumped = kpi.model_dump()

    assert 'revenueByDay' not in dumped
    assert 'revenueByMonth' not in dumped
    assert 'units' not in dumped
