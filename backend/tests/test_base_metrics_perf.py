"""Перформанс и контракт snapshot / month series / ETag / SQL budget."""

from __future__ import annotations

from datetime import date
from uuid import uuid4

from sqlalchemy import event

from src.db.session import Base, DataBaseManager
from src.services.analytics.queries import period_monthly
from src.services.base_metrics import metric_series, metric_snapshot
from src.schemas.base_metrics import MetricName, SeriesGranularity, SnapshotMode
from src.services.sales import ingest_records, parse_records
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw


def _session():
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    return manager.get_session(), manager.engine


def _count_sql(engine):
    box = {'n': 0}

    def _before(conn, cursor, statement, parameters, context, executemany):
        box['n'] += 1

    event.listen(engine, 'before_cursor_execute', _before)
    return box


def test_period_monthly_exactly_two_sql():
    session, engine = _session()
    try:
        restaurant = create_restaurant(session)
        records = []
        for month in range(1, 7):
            records.append(make_raw(**{
                'ItemSaleEvent.Id': str(uuid4()),
                'OpenDate.Typed': f'2026-{month:02d}-15',
                'OrderNum': month,
                'SessionNum': 100 + month,
                'DishSumInt': 100,
                'DishDiscountSumInt': 100,
            }))
        ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
        rid = restaurant.id
        session.commit()

        counter = _count_sql(engine)
        before = counter['n']
        months = period_monthly(
            session, rid, date(2026, 1, 1), date(2026, 6, 30),
        )
        assert counter['n'] - before == 2
        assert len(months) == 6
        assert months[date(2026, 3, 1)]['revenue'] > 0

        series = metric_series(
            session, rid, MetricName.revenue,
            date(2026, 1, 1), date(2026, 6, 30),
            granularity=SeriesGranularity.month,
        )
        assert series.granularity == SeriesGranularity.month
        assert len(series.points) == 6
    finally:
        session.close()


def test_snapshot_full_has_batch_units_series_forecast():
    session, _engine = _session()
    try:
        restaurant = create_restaurant(session)
        for day in range(1, 9):
            ingest_records(session, parse_records([make_raw(**{
                'ItemSaleEvent.Id': str(uuid4()),
                'OpenDate.Typed': f'2026-06-{day:02d}',
                'OrderNum': day,
                'SessionNum': 200 + day,
                'DishSumInt': 100,
                'DishDiscountSumInt': 100,
            })]), restaurant_id=restaurant.id)
        session.commit()

        snap = metric_snapshot(
            session, restaurant.id,
            date(2026, 6, 1), date(2026, 6, 8),
            mode=SnapshotMode.full,
        )
        assert snap.mode == SnapshotMode.full
        assert len(snap.batch.items) == 4
        assert len(snap.units.units) == 4
        assert len(snap.day_series) == 3
        assert len(snap.forecasts) == 3
        assert snap.forecasts[0].ready is True
    finally:
        session.close()


def test_snapshot_resolves_year_month_without_explicit_dates():
    session, _engine = _session()
    try:
        restaurant = create_restaurant(session)
        ingest_records(session, parse_records([make_raw(**{
            'ItemSaleEvent.Id': str(uuid4()),
            'OpenDate.Typed': '2026-06-10',
            'OrderNum': 1,
            'SessionNum': 1,
            'DishSumInt': 100,
            'DishDiscountSumInt': 100,
        })]), restaurant_id=restaurant.id)
        session.commit()

        snap = metric_snapshot(
            session, restaurant.id,
            mode=SnapshotMode.kpi,
            year=2026,
            month=6,
        )
        assert snap.date_from == date(2026, 6, 1)
        assert snap.date_to == date(2026, 6, 10)
        assert snap.mode == SnapshotMode.kpi
        assert len(snap.batch.items) == 4
        assert snap.day_series == []
    finally:
        session.close()


def test_api_snapshot_and_etag_304(client):
    first = client.get('/api/base-metrics/snapshot')
    assert first.status_code == 200
    etag = first.headers.get('etag')
    assert etag
    body = first.json()
    assert 'batch' in body
    assert body['date_from'] <= body['date_to']

    second = client.get(
        '/api/base-metrics/snapshot',
        headers={'If-None-Match': etag},
    )
    assert second.status_code == 304
    assert second.headers.get('etag') == etag


def test_api_snapshot_year_month_and_domain_error_envelope(client):
    by_month = client.get(
        '/api/base-metrics/snapshot',
        params={'year': 2099, 'month': 1, 'mode': 'kpi'},
    )
    assert by_month.status_code == 422
    detail = by_month.json()['detail']
    assert isinstance(detail, dict)
    assert detail['code'] == 'base_metrics_domain'
    assert 'future' in detail['message'].lower() or 'Future' in detail['message']
