"""Tenant isolation for sales / base-metrics data."""

import pytest

from src.schemas.base_metrics import MetricName
from src.services.base_metrics import metric_snapshot
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


def _revenue(snap) -> float:
    for item in snap.batch.items:
        if item.metric == MetricName.revenue:
            return float(item.value or 0)
    return 0.0


def test_base_metrics_are_scoped_by_restaurant(session):
    restaurant_a = create_restaurant(session)
    restaurant_b = create_restaurant(session)
    ingest_records(session, parse_records([RAW]), restaurant_id=restaurant_a.id)
    session.commit()

    snap_a = metric_snapshot(session, restaurant_a.id)
    snap_b = metric_snapshot(session, restaurant_b.id)

    assert _revenue(snap_a) > 0
    assert _revenue(snap_b) == 0
