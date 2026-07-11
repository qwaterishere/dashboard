"""Tenant isolation for sales/dashboard data."""

import pytest

from src.services.dashboard import build_dashboard
from src.services.sales import build_sales, ingest_records, parse_records
from tests.factories import create_restaurant
from tests.sales.test_ingest import RAW


@pytest.fixture()
def session():
    from src.db.session import Base, DataBaseManager

    manager = DataBaseManager("sqlite:///:memory:")
    Base.metadata.create_all(manager.engine)
    db = manager.get_session()
    yield db
    db.close()


def test_users_see_only_their_sales(session):
    restaurant_a = create_restaurant(session)
    restaurant_b = create_restaurant(session)
    records = parse_records([RAW])

    ingest_records(session, records, restaurant_id=restaurant_a.id)
    session.commit()

    page_a = build_sales(session, restaurant_a.id)
    page_b = build_sales(session, restaurant_b.id)

    assert len(page_a.positions) == 1
    assert page_b.positions == []


def test_dashboard_is_scoped_by_restaurant(session):
    restaurant_a = create_restaurant(session)
    restaurant_b = create_restaurant(session)
    ingest_records(session, parse_records([RAW]), restaurant_id=restaurant_a.id)
    session.commit()

    dash_a = build_dashboard(session, restaurant_a.id)
    dash_b = build_dashboard(session, restaurant_b.id)

    assert dash_a.kpis.revenue.value > 0
    assert dash_b.kpis.revenue.value == 0
