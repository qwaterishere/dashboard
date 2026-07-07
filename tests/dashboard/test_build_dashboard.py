"""Тесты сборки дашборда v2: LfL, честные нули/None, платные чеки, прогноз."""

from datetime import date

import pytest

from src.dashboard.schemas import Dashboard
from src.dashboard.service import build_dashboard, _same_period_last_year
from src.database import DataBaseManager, Base
from src.sales.service import ingest_records, parse_records
from tests.sales.test_ingest import make_raw


@pytest.fixture()
def session():
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    session = manager.get_session()
    yield session
    session.close()


def _sale(day: str, order: int, uid: str, paid: float = 500, guests: int = 2):
    return make_raw(**{
        'ItemSaleEvent.Id': uid, 'OpenDate.Typed': day, 'OrderNum': order,
        'SessionNum': 900, 'GuestNum': guests,
        'DishSumInt': paid, 'DishDiscountSumInt': paid,
    })


def test_empty_db_gives_typed_zeros(session):
    page = build_dashboard(session)
    assert isinstance(page, Dashboard)
    assert page.kpis.revenue.value == 0
    assert page.kpis.revenue.prevValue is None        # сравнивать не с чем
    assert page.kpis.revenue.forecast is None    # прогноз не готов
    assert [u.key for u in page.units] == ['k', 'b', 'w', 'o']


def test_lfl_and_calendar(session):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, '11111111-0000-0000-0000-000000000001'),
        _sale('2026-06-03', 2, '11111111-0000-0000-0000-000000000002', paid=700),
        # прошлый год, те же числа
        _sale('2025-06-02', 3, '22222222-0000-0000-0000-000000000001', paid=400),
    ]))
    session.commit()

    page = build_dashboard(session)
    assert page.period.year == 2026 and page.period.dayTo == 3
    assert page.compare.year == 2025
    assert page.kpis.revenue.value == 1200
    assert page.kpis.revenue.prevValue == 400
    # полный календарь: 2 июня без продаж, но присутствует нулями
    assert [d.day for d in page.revenueByDay] == [1, 2, 3]
    assert page.revenueByDay[1].revenue == 0
    assert page.revenueByDay[0].plan is None
    # 3 закрытых дня < 7 -> прогноз не готов
    assert page.kpis.revenue.forecast is None


def test_free_order_not_in_checks_but_in_data(session):
    ingest_records(session, parse_records([
        _sale('2026-06-01', 1, '33333333-0000-0000-0000-000000000001', paid=1000),
        # целиком бесплатный чек (представительские): paid_total == 0
        _sale('2026-06-01', 2, '33333333-0000-0000-0000-000000000002',
              paid=0, guests=5),
    ]))
    session.commit()

    page = build_dashboard(session)
    assert page.kpis.checks.value == 1       # бесплатный чек — не продажа
    assert page.kpis.guests.value == 2       # его 5 «гостей» не считаются
    assert page.kpis.revenue.value == 1000   # выручке фильтр безразличен
    assert page.kpis.avgCheck.value == 1000  # средний не размыт нулевым чеком


def test_forecast_after_seven_days_ignores_one_off_closure(session):
    records = []
    # 8 закрытых дней июня-2026; 4 июня (чт) — разовый простой (нет продаж)
    for i, day in enumerate(('01', '02', '03', '05', '06', '07', '08')):
        records.append(_sale(f'2026-06-{day}', 10 + i,
                             f'44444444-0000-0000-0000-0000000000{i:02d}',
                             paid=1000))
    # история за прошлые недели: четверги РАБОТАЛИ (28 мая — чт)
    records.append(_sale('2026-05-28', 50,
                         '55555555-0000-0000-0000-000000000001', paid=900))
    ingest_records(session, parse_records(records))
    session.commit()

    page = build_dashboard(session)
    forecast = page.kpis.revenue.forecast
    assert forecast is not None
    # будущие четверги прогнозируются по истории (900), а не нулём:
    # факт 7000 + прогноз остатка месяца > факт
    assert forecast > 7000


def test_feb29_compare_clamped():
    p_from, p_to = _same_period_last_year(date(2028, 2, 1), date(2028, 2, 29))
    assert (p_from, p_to) == (date(2027, 2, 1), date(2027, 2, 28))
