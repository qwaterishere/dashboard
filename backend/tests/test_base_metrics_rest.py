"""REST /api/base-metrics — контракт и изоляция."""

from __future__ import annotations

import uuid
from datetime import date

from src.db.models.restaurant import Restaurant
from src.db.models.user import User
from src.db.session import db_manager
from src.schemas.base_metrics import MetricName
from src.services.restaurant import get_or_create_restaurant
from src.services.sales import ingest_records, parse_records
from tests.conftest import TEST_USER
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw


def _sale(day: str, order: int, *, paid: float = 500, guests: int = 2):
    return make_raw(**{
        'ItemSaleEvent.Id': str(uuid.uuid4()),
        'OpenDate.Typed': day,
        'OrderNum': order,
        'SessionNum': 900 + order,
        'GuestNum': guests,
        'DishSumInt': paid,
        'DishDiscountSumInt': paid,
        'ProductCostBase.ProductCost': paid * 0.3,
    })


def _authed_restaurant(session) -> Restaurant:
    user = session.query(User).filter(User.email == TEST_USER['email']).one()
    return get_or_create_restaurant(session, user)


def _seed_days(session, restaurant_id, days: list[tuple[str, float]]) -> float:
    records = [
        _sale(day, idx + 1, paid=paid)
        for idx, (day, paid) in enumerate(days)
    ]
    ingest_records(session, parse_records(records), restaurant_id=restaurant_id)
    session.commit()
    return sum(paid for _, paid in days)


def test_openapi_contains_avg_check_enum(client):
    schema = client.get('/openapi.json').json()
    metric_schema = schema['components']['schemas']['MetricName']
    assert 'avg-check' in metric_schema['enum']
    assert 'avg-check-per-guest' in metric_schema['enum']


def test_bounds_and_default_period(client):
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        _seed_days(session, restaurant.id, [
            ('2026-06-10', 1000.0),
            ('2026-06-11', 1000.0),
        ])
    finally:
        session.close()

    bounds = client.get('/api/base-metrics/bounds')
    assert bounds.status_code == 200
    body = bounds.json()
    assert body['date_from'] is not None
    assert body['date_to'] is not None
    assert body['date_from'] <= body['date_to']
    assert bounds.headers.get('etag')

    default = client.get('/api/base-metrics/period/default')
    assert default.status_code == 200
    period = default.json()
    assert period['mode'] == 'month'
    assert period['date_from'] <= period['date_to']
    assert period['bounds']['date_to'] == body['date_to']


def test_fact_year_allowed_series_capped(client):
    fact = client.get(
        '/api/base-metrics/revenue',
        params={'date_from': '2025-01-01', 'date_to': '2025-12-31'},
    )
    assert fact.status_code == 200
    assert fact.json()['value'] == 0

    series_ok = client.get(
        '/api/base-metrics/revenue/series',
        params={'date_from': '2026-01-01', 'date_to': '2026-12-31'},
    )
    assert series_ok.status_code == 200
    assert len(series_ok.json()['points']) == 365

    series_bad = client.get(
        '/api/base-metrics/revenue/series',
        params={'date_from': '2025-01-01', 'date_to': '2026-01-02'},
    )
    assert series_bad.status_code == 422
    detail = series_bad.json()['detail']
    message = detail['message'] if isinstance(detail, dict) else detail
    assert '366' in message


def test_avg_null_when_no_checks_and_no_revenue_round(client):
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        total = _seed_days(session, restaurant.id, [('2026-08-15', 123.456)])
    finally:
        session.close()

    empty_avg = client.get(
        '/api/base-metrics/avg-check',
        params={'date_from': '2026-01-01', 'date_to': '2026-01-31'},
    )
    assert empty_avg.status_code == 200
    assert empty_avg.json()['value'] is None

    revenue = client.get(
        '/api/base-metrics/revenue',
        params={'date_from': '2026-08-15', 'date_to': '2026-08-15'},
    )
    assert revenue.status_code == 200
    assert revenue.json()['value'] == total

    avg = client.get(
        '/api/base-metrics/avg-check',
        params={'date_from': '2026-08-15', 'date_to': '2026-08-15'},
    )
    assert avg.status_code == 200
    assert avg.json()['value'] == total


def test_compare_base_incomplete_and_custom_base(client):
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        _seed_days(session, restaurant.id, [
            ('2026-09-10', 400.0),
            ('2026-09-11', 600.0),
        ])
    finally:
        session.close()

    bounds = client.get('/api/base-metrics/bounds').json()

    compare = client.get(
        '/api/base-metrics/revenue/compare',
        params={'date_from': '2026-09-01', 'date_to': '2026-09-11'},
    )
    assert compare.status_code == 200
    body = compare.json()
    assert body['base_date_from'] == '2026-08-01'
    assert body['base_date_to'] == '2026-08-11'
    assert body['value'] == 1000.0
    assert body['base_incomplete'] is (body['base_date_from'] < bounds['date_from'])

    # База до начала истории — всегда incomplete.
    early = client.get(
        '/api/base-metrics/revenue/compare',
        params={
            'date_from': '2026-09-10',
            'date_to': '2026-09-11',
            'base_from': '2000-01-01',
            'base_to': '2000-01-02',
        },
    )
    assert early.status_code == 200
    assert early.json()['base_incomplete'] is True

    custom = client.get(
        '/api/base-metrics/revenue/compare',
        params={
            'date_from': '2026-09-10',
            'date_to': '2026-09-11',
            'base_from': '2026-09-10',
            'base_to': '2026-09-10',
        },
    )
    assert custom.status_code == 200
    custom_body = custom.json()
    assert custom_body['base_value'] == 400.0
    assert custom_body['base_incomplete'] is False

    compare_again = client.get(
        '/api/base-metrics/revenue/compare',
        params={'date_from': '2026-09-01', 'date_to': '2026-09-11'},
    )
    assert compare_again.status_code == 200
    assert compare_again.json()['value'] == compare.json()['value']


def test_batch_units_forecast_series_month(client):
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        _seed_days(session, restaurant.id, [
            ('2026-10-01', 100.0),
            ('2026-10-02', 100.0),
            ('2026-10-03', 100.0),
            ('2026-10-04', 100.0),
            ('2026-10-05', 100.0),
            ('2026-10-06', 100.0),
            ('2026-10-07', 100.0),
            ('2026-10-08', 100.0),
        ])
    finally:
        session.close()

    batch = client.get(
        '/api/base-metrics/batch',
        params={
            'metrics': 'revenue,checks,avg-check',
            'date_from': '2026-10-01',
            'date_to': '2026-10-08',
            'include_compare': True,
        },
    )
    assert batch.status_code == 200
    items = {item['metric']: item for item in batch.json()['items']}
    assert items['revenue']['value'] == 800.0
    assert items['checks']['value'] == 8
    assert items['avg-check']['value'] == 100.0
    assert isinstance(items['revenue']['base_incomplete'], bool)
    assert items['revenue']['base_date_from'] == '2026-09-01'

    units = client.get(
        '/api/base-metrics/units',
        params={'date_from': '2026-10-01', 'date_to': '2026-10-08'},
    )
    assert units.status_code == 200
    by_key = {u['key']: u for u in units.json()['units']}
    assert set(by_key) == {'k', 'b', 'w', 'o'}
    assert by_key['k']['revenue'] == 800.0

    series = client.get(
        '/api/base-metrics/revenue/series',
        params={
            'date_from': '2026-01-01',
            'date_to': '2026-06-30',
            'granularity': 'month',
        },
    )
    assert series.status_code == 200
    assert series.json()['granularity'] == 'month'
    assert len(series.json()['points']) == 6

    forecast = client.get(
        '/api/base-metrics/revenue/forecast',
        params={'date_from': '2026-10-01', 'date_to': '2026-10-08'},
    )
    assert forecast.status_code == 200
    assert forecast.json()['ready'] is True
    assert forecast.json()['forecast'] is not None

    bad_forecast = client.get(
        '/api/base-metrics/avg-check/forecast',
        params={'date_from': '2026-10-01', 'date_to': '2026-10-08'},
    )
    assert bad_forecast.status_code == 422


def test_tenant_isolation_service_level():
    from src.db.session import Base, DataBaseManager
    from src.services.base_metrics import metric_fact

    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    session = manager.get_session()
    try:
        a = create_restaurant(session)
        b = create_restaurant(session)
        ingest_records(session, parse_records([
            _sale('2026-06-10', 1, paid=500.0),
        ]), restaurant_id=a.id)
        session.commit()

        fact_a = metric_fact(
            session, a.id, MetricName.revenue,
            date(2026, 6, 1), date(2026, 6, 30),
        )
        fact_b = metric_fact(
            session, b.id, MetricName.revenue,
            date(2026, 6, 1), date(2026, 6, 30),
        )
        assert fact_a.value == 500.0
        assert fact_b.value == 0.0
    finally:
        session.close()


def test_dates_not_clamped_unlike_sales(client):
    """base-metrics не усекает период; value = сумма внутри запрошенных дат."""
    session = db_manager.get_session()
    try:
        restaurant = _authed_restaurant(session)
        total = _seed_days(session, restaurant.id, [('2026-11-20', 250.0)])
    finally:
        session.close()

    fact = client.get(
        '/api/base-metrics/revenue',
        params={'date_from': '2026-01-01', 'date_to': '2026-12-31'},
    )
    assert fact.status_code == 200
    assert fact.json()['date_from'] == '2026-01-01'
    assert fact.json()['date_to'] == '2026-12-31'
    assert fact.json()['value'] >= total
