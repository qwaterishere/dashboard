"""LfL KPI и weekKpi overlay для недельного датафрейма."""

from datetime import date

import pytest

from src.services.dashboard import build_dashboard
from src.services.dashboard_week import (
    build_week_kpi_overlay,
    previous_week_range,
    validate_week_range,
)
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


def _sale(day: str, order: int, uid: str, paid: float = 500, guests: int = 2):
    return make_raw(**{
        'ItemSaleEvent.Id': uid, 'OpenDate.Typed': day, 'OrderNum': order,
        'SessionNum': 900, 'GuestNum': guests,
        'DishSumInt': paid, 'DishDiscountSumInt': paid,
    })


def test_previous_week_range():
    start, end = previous_week_range(date(2026, 6, 8), date(2026, 6, 14))
    assert start == date(2026, 6, 1)
    assert end == date(2026, 6, 7)


def test_validate_week_range_rejects_non_seven_days():
    with pytest.raises(ValueError, match="exactly 7 days"):
        validate_week_range(date(2026, 6, 8), date(2026, 6, 13))


def test_week_kpi_lfl_and_peak(session, restaurant):
    records = [
        _sale('2026-06-08', 1, 'aaaaaaaa-0000-0000-0000-000000000001', paid=1000),
        _sale('2026-06-09', 2, 'aaaaaaaa-0000-0000-0000-000000000002', paid=2000),
        _sale('2026-06-10', 3, 'aaaaaaaa-0000-0000-0000-000000000003', paid=1500),
        _sale('2026-06-11', 4, 'aaaaaaaa-0000-0000-0000-000000000004', paid=800),
        _sale('2026-06-12', 5, 'aaaaaaaa-0000-0000-0000-000000000005', paid=1200),
        _sale('2026-06-13', 6, 'aaaaaaaa-0000-0000-0000-000000000006', paid=900),
        _sale('2026-06-14', 7, 'aaaaaaaa-0000-0000-0000-000000000007', paid=600),
        # LfL: предыдущая календарная неделя
        _sale('2026-06-01', 10, 'bbbbbbbb-0000-0000-0000-000000000001', paid=500),
        _sale('2026-06-02', 11, 'bbbbbbbb-0000-0000-0000-000000000002', paid=700),
    ]
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    overlay = build_week_kpi_overlay(
        session,
        restaurant.id,
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
        anchor_year=2026,
        anchor_month=6,
        latest=date(2026, 6, 14),
    )

    assert overlay['weekKpi']['comparison'] == 'lfl'
    assert overlay['weekKpi']['weekStart'] == date(2026, 6, 8)
    assert overlay['weekKpi']['prevWeekStart'] == date(2026, 6, 1)
    assert overlay['kpis']['revenue']['value'] == 8000
    assert overlay['kpis']['revenue']['prevValue'] == 1200
    assert overlay['kpis']['revenue']['forecast'] is None
    assert overlay['weekKpi']['peakDay']['revenue'] == 2000
    assert overlay['compare']['year'] == 2026


def test_build_dashboard_with_week_params(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-08', 1, 'cccccccc-0000-0000-0000-000000000001', paid=1000),
        _sale('2026-06-01', 2, 'dddddddd-0000-0000-0000-000000000001', paid=400),
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(
        session,
        restaurant.id,
        year=2026,
        month=6,
        week_start=date(2026, 6, 8),
        week_end=date(2026, 6, 14),
    )

    assert page.weekKpi is not None
    assert page.kpis.revenue.value == 1000
    assert page.kpis.revenue.prevValue == 400
    assert page.kpis.revenue.forecast is None
    assert page.compare.year == 2026 and page.compare.month == 6
    assert page.period.month == 6
    assert page.period.dayTo == 8
    assert len(page.revenueByDay) == 30
