"""Lightweight chart endpoint — graph + units without KPI layer."""

from datetime import date

import pytest

from src.services.dashboard import build_dashboard, build_dashboard_chart
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


def _sale(day: str, order: int, uid: str, paid: float = 500, group: str = 'Кухня'):
    return make_raw(**{
        'ItemSaleEvent.Id': uid, 'OpenDate.Typed': day, 'OrderNum': order,
        'SessionNum': 900, 'GuestNum': 2,
        'DishSumInt': paid, 'DishDiscountSumInt': paid,
        'DishGroup.TopParent': group,
    })


def test_chart_matches_full_dashboard_graph(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
        _sale('2026-06-02', 2, 'aaaaaaaa-0000-0000-0000-000000000002', paid=500),
        _sale('2026-05-01', 3, 'bbbbbbbb-0000-0000-0000-000000000001', paid=200),
    ]), restaurant_id=restaurant.id)
    session.commit()

    full = build_dashboard(session, restaurant.id)
    chart = build_dashboard_chart(session, restaurant.id)

    assert chart.period == full.period
    assert chart.compare == full.compare
    assert chart.revenueByDay == full.revenueByDay
    assert chart.revenueByMonth == full.revenueByMonth
    assert chart.units == full.units
    assert chart.dataBounds == full.dataBounds


def test_chart_omits_kpi_payload(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
    ]), restaurant_id=restaurant.id)
    session.commit()

    chart = build_dashboard_chart(session, restaurant.id)
    dumped = chart.model_dump()

    assert 'kpis' not in dumped
    assert chart.revenueByDay
    assert len(chart.units) == 4


def test_chart_week_mode_includes_week_kpi(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-09', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
        _sale('2026-06-10', 2, 'aaaaaaaa-0000-0000-0000-000000000002', paid=500),
    ]), restaurant_id=restaurant.id)
    session.commit()

    full = build_dashboard(
        session,
        restaurant.id,
        year=2026,
        month=6,
        week_start=date(2026, 6, 9),
        week_end=date(2026, 6, 15),
    )
    chart = build_dashboard_chart(
        session,
        restaurant.id,
        year=2026,
        month=6,
        week_start=date(2026, 6, 9),
        week_end=date(2026, 6, 15),
    )

    assert chart.weekKpi is not None
    assert chart.weekKpi.weekStart == full.weekKpi.weekStart
    assert chart.weekKpi.weekEnd == full.weekKpi.weekEnd
    assert 'kpis' not in chart.model_dump()
