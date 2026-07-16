"""Тесты сборки дашборда v2: LfL, честные нули/None, платные чеки, прогноз."""

from datetime import date

import pytest

from src.schemas.dashboard import Dashboard
from src.services.dashboard import build_dashboard, build_dashboard_kpi
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
    # полный календарь месяца: закрытые и будущие дни с нулями
    assert len(page.revenueByDay) == 30
    assert [d.day for d in page.revenueByDay[:3]] == [1, 2, 3]
    assert page.revenueByDay[1].revenue == 0
    assert page.revenueByDay[0].plan is None
    assert page.revenueByDay[0].forecast is None  # прогноз не готов (< 7 дней)
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


def test_revenue_by_day_and_month_forecast_marks(session, restaurant):
    """Засечки графика: дневной прогноз и сумма по месяцу."""
    records = []
    for i, day in enumerate(('01', '02', '03', '04', '05', '06', '07', '08')):
        records.append(_sale(
            f'2026-06-{day}',
            i + 1,
            f'dddddddd-0000-0000-0000-{i:012d}',
            paid=1000,
        ))
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id)
    assert page.revenueByDay[0].forecast == 1000
    assert page.revenueByDay[7].revenue == 1000
    assert page.revenueByDay[7].forecast == 1000
    # будущие дни месяца: факт 0, прогноз есть
    assert page.revenueByDay[8].revenue == 0
    assert page.revenueByDay[8].forecast == 1000
    assert len(page.revenueByDay) == 30

    june = page.revenueByMonth[-1]
    assert june.month == 6
    assert june.forecast is not None
    assert june.forecast > june.revenue


def test_year_monthly_forecast_marks(session, restaurant):
    records = []
    for i, day in enumerate(('01', '02', '03', '04', '05', '06', '07', '08')):
        records.append(_sale(
            f'2026-01-{day}',
            i + 1,
            f'eeeeeeee-0000-0000-0000-{i:012d}',
            paid=1000,
        ))
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id, year=2026)
    jan = page.revenueByMonth[0]
    assert jan.month == 1
    assert jan.forecast is not None
    assert jan.forecast > jan.revenue


def test_year_forecast_projects_to_year_end(session, restaurant):
    """Year-mode: прогноз до 31.12, а не до конца января (баг horizon)."""
    records = []
    for i, day in enumerate(('01', '02', '03', '04', '05', '06', '07', '08')):
        records.append(_sale(
            f'2026-01-{day}',
            i + 1,
            f'aaaaaaaa-0000-0000-0000-{i:012d}',
            paid=1000,
        ))
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    month_page = build_dashboard(session, restaurant.id)
    year_page = build_dashboard(session, restaurant.id, year=2026)
    year_kpi = build_dashboard_kpi(session, restaurant.id, year=2026)

    assert year_page.period.year == 2026
    assert year_page.period.month == 1
    assert year_page.period.dayFrom == 1
    assert year_page.period.dayTo == 8
    assert year_page.kpis.revenue.value == 8000

    month_fc = month_page.kpis.revenue.forecast
    year_fc = year_page.kpis.revenue.forecast
    assert month_fc is not None
    assert year_fc is not None
    # Месяц: остаток января (~23 дня); год: остаток до 31.12 (~357 дней).
    assert year_fc > month_fc
    assert year_fc > 8000
    # KPI-слой отдаёт тот же годовой горизонт.
    assert year_kpi.kpis.revenue.forecast == year_fc


def test_year_forecast_equals_fact_when_year_complete(session, restaurant):
    """Закрытый год без оставшихся дней: прогноз = факт."""
    records = [
        _sale('2025-12-25', 1, 'bbbbbbbb-0000-0000-0000-000000000001', paid=500),
        _sale('2025-12-26', 2, 'bbbbbbbb-0000-0000-0000-000000000002', paid=500),
        _sale('2025-12-27', 3, 'bbbbbbbb-0000-0000-0000-000000000003', paid=500),
        _sale('2025-12-28', 4, 'bbbbbbbb-0000-0000-0000-000000000004', paid=500),
        _sale('2025-12-29', 5, 'bbbbbbbb-0000-0000-0000-000000000005', paid=500),
        _sale('2025-12-30', 6, 'bbbbbbbb-0000-0000-0000-000000000006', paid=500),
        _sale('2025-12-31', 7, 'bbbbbbbb-0000-0000-0000-000000000007', paid=500),
    ]
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id, year=2025)
    assert page.period.dayTo == 31
    assert page.kpis.revenue.value == 3500
    assert page.kpis.revenue.forecast == 3500
    assert page.kpis.revenue.forecastToday is None  # период закрыт — без pace


def test_forecast_today_pace_below_end_forecast(session, restaurant):
    """Pace (к d_to) меньше прогноза на конец месяца; равномерные дни → pace ≈ факт."""
    records = []
    for i, day in enumerate(('01', '02', '03', '04', '05', '06', '07', '08')):
        records.append(_sale(
            f'2026-06-{day}',
            i + 1,
            f'cccccccc-0000-0000-0000-{i:012d}',
            paid=1000,
        ))
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id)
    assert page.kpis.revenue.forecast is not None
    assert page.kpis.revenue.forecastToday is not None
    assert page.kpis.revenue.forecastToday == 8000  # 8 × 1000 avg
    assert page.kpis.revenue.forecast > page.kpis.revenue.forecastToday
    assert page.kpis.avgCheck.forecastToday is not None


def test_forecast_today_null_for_completed_month(session, restaurant):
    """Закрытый месяц: засечка pace не отдаётся."""
    records = []
    for i, day in enumerate(('01', '02', '03', '04', '05', '06', '07', '08')):
        records.append(_sale(
            f'2026-05-{day}',
            i + 1,
            f'dddddddd-0000-0000-0000-{i:012d}',
            paid=1000,
        ))
    # latest сдвигает «текущий» месяц на июнь — май отдаётся целиком
    records.append(_sale('2026-06-01', 99, 'dddddddd-0000-0000-0000-000000000099', paid=100))
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_dashboard(session, restaurant.id, year=2026, month=5)
    assert page.period.dayTo == 31
    assert page.kpis.revenue.forecast is not None
    assert page.kpis.revenue.forecastToday is None


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
