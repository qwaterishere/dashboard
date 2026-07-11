"""ETag / 304 для GET /api/dashboard."""

from src.db.models.restaurant import Restaurant
from src.db.models.user import User
from src.db.session import db_manager
from src.services.dashboard_etag import compute_dashboard_etag
from src.services.restaurant import get_or_create_restaurant
from src.services.sales import ingest_records, parse_records
from tests.conftest import TEST_USER
from tests.sales.test_ingest import make_raw


def _sale(day: str, order: int, uid: str, paid: float = 500):
    return make_raw(**{
        'ItemSaleEvent.Id': uid,
        'OpenDate.Typed': day,
        'OrderNum': order,
        'SessionNum': 900,
        'GuestNum': 2,
        'DishSumInt': paid,
        'DishDiscountSumInt': paid,
    })


def _authed_restaurant(session) -> Restaurant:
    user = session.query(User).filter(User.email == TEST_USER["email"]).one()
    return get_or_create_restaurant(session, user)


def test_compute_dashboard_etag_is_stable_for_same_data():
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        ingest_records(session, parse_records([
            _sale('2026-06-01', 1, '11111111-0000-0000-0000-000000000001'),
        ]), restaurant_id=restaurant.id)
        session.commit()

        first = compute_dashboard_etag(session, restaurant.id, year=2026, month=6)
        second = compute_dashboard_etag(session, restaurant.id, year=2026, month=6)
        assert first == second
        assert first.startswith('W/"')
    finally:
        session.close()


def test_dashboard_returns_etag_and_supports_304(client):
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        ingest_records(session, parse_records([
            _sale('2026-06-03', 3, '11111111-0000-0000-0000-000000000003'),
        ]), restaurant_id=restaurant.id)
        session.commit()
    finally:
        session.close()

    first = client.get("/api/dashboard")
    assert first.status_code == 200
    etag = first.headers.get("etag")
    assert etag is not None
    assert etag.startswith('W/"')
    assert first.headers.get("cache-control") == "private, no-cache"

    second = client.get("/api/dashboard", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.headers.get("etag") == etag
    assert second.content == b""


def test_dashboard_etag_changes_after_new_sales(client):
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        ingest_records(session, parse_records([
            _sale('2026-07-01', 40, '11111111-0000-0000-0000-00000000a040'),
        ]), restaurant_id=restaurant.id)
        session.commit()
    finally:
        session.close()

    before = client.get("/api/dashboard", params={"year": 2026, "month": 7}).headers["etag"]

    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        ingest_records(session, parse_records([
            _sale('2026-07-02', 41, '11111111-0000-0000-0000-00000000a041'),
        ]), restaurant_id=restaurant.id)
        session.commit()
    finally:
        session.close()

    after = client.get("/api/dashboard", params={"year": 2026, "month": 7}).headers["etag"]
    assert before != after
