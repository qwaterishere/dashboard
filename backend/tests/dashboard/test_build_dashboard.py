"""Тесты сборки дашборда v2: LfL, честные нули/None, платные чеки, прогноз."""

from datetime import date

import pytest

from src.schemas.dashboard import Dashboard
from src.services.dashboard import build_dashboard
from src.db.session import DataBaseManager, Base
from src.services.sales import ingest_records, parse_records
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw


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


def _sale(day: str, order: int, uid: str, paid: float = 500, guests: int = 2):
    return make_raw(**{
        'ItemSaleEvent.Id': uid, 'OpenDate.Typed': day, 'OrderNum': order,
        'SessionNum': 900, 'GuestNum': guests,
        'DishSumInt': paid, 'DishDiscountSumInt': paid,
    })


def test_empty_db_gives_typed_zeros(session, restaurant):
    page = build_dashboard(session, restaurant.id)
    assert isinstance(page, Dashboard)
    assert page.kpis.revenue.value == 0
    assert page.kpis.revenue.prevValue is None        # сравнивать не с чем
    assert page.kpis.revenue.forecast is None    # прогноз не готов
    assert [u.key for u in page.units] == ['k', 'b', 'w', 'o']


def test_lfl_and_calendar(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, '11111111-0000-0000-0000-000000000001'),
        _sale('2026-06-03', 2, '11111111-0000-0000-0000-000000000002', paid=700),
        # предыдущий месяц, те же числа
        _sale('2026-05-02', 3, '22222222-0000-0000-0000-000000000001', paid=400),
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id)
    assert page.period.year == 2026 and page.period.dayTo == 3
    assert page.compare.year == 2026 and page.compare.month == 5
    assert page.kpis.revenue.value == 1200
    assert page.kpis.revenue.prevValue == 400
    # полный календарь: 2 июня без продаж, но присутствует нулями
    assert [d.day for d in page.revenueByDay] == [1, 2, 3]
    assert page.revenueByDay[1].revenue == 0
    assert page.revenueByDay[0].plan is None
    assert len(page.revenueByMonth) == 2
    assert page.revenueByMonth[0].month == 5
    assert page.revenueByMonth[1].month == 6
    assert page.revenueByMonth[0].revenue == 400
    assert page.revenueByMonth[1].revenue == 1200
    assert page.kpis.revenue.forecast is None


def test_free_order_not_in_checks_but_in_data(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, '33333333-0000-0000-0000-000000000001', paid=1000),
        # целиком бесплатный чек (представительские): paid_total == 0
        _sale('2026-06-01', 2, '33333333-0000-0000-0000-000000000002',
              paid=0, guests=5),
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id)
    assert page.kpis.checks.value == 1       # бесплатный чек — не продажа
    assert page.kpis.guests.value == 2       # его 5 «гостей» не считаются
    assert page.kpis.revenue.value == 1000   # выручке фильтр безразличен
    assert page.kpis.avgCheck.value == 1000  # средний не размыт нулевым чеком


def test_forecast_after_seven_days_ignores_one_off_closure(session, restaurant):
    records = []
    # 8 закрытых дней июня-2026; 4 июня (чт) — разовый простой (нет продаж)
    for i, day in enumerate(('01', '02', '03', '05', '06', '07', '08')):
        records.append(_sale(f'2026-06-{day}', 10 + i,
                             f'44444444-0000-0000-0000-0000000000{i:02d}',
                             paid=1000))
    # история за прошлые недели: четверги РАБОТАЛИ (28 мая — чт)
    records.append(_sale('2026-05-28', 50,
                         '55555555-0000-0000-0000-000000000001', paid=900))
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id)
    forecast = page.kpis.revenue.forecast
    assert forecast is not None
    # будущие четверги прогнозируются по истории (900), а не нулём:
    # факт 7000 + прогноз остатка месяца > факт
    assert forecast > 7000


def test_build_dashboard_for_selected_month(session, restaurant):
    ingest_records(session, parse_records([
        _sale('2026-05-01', 1, '66666666-0000-0000-0000-000000000001', paid=300),
        _sale('2026-06-01', 2, '77777777-0000-0000-0000-000000000001', paid=500),
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id, year=2026, month=5)
    assert page.period.month == 5
    assert page.period.dayTo == 31
    assert page.compare.year == 2026 and page.compare.month == 4
    assert page.kpis.revenue.value == 300
    assert page.dataBounds.latest == date(2026, 6, 1)
