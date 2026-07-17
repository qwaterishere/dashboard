"""Тесты сборки страницы «Продажи» из БД."""

from datetime import date

import pytest

from src.db.session import DataBaseManager, Base
from src.services.sales import build_sales, ingest_records, parse_records
from tests.factories import create_restaurant
from tests.sales.test_ingest import RAW, make_raw


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


def test_empty_db_gives_empty_page(session, restaurant):
    page = build_sales(session, restaurant.id)
    assert page.positions == []


def test_default_period_is_month_of_last_closed_day(session, restaurant):
    """Без параметров — месяц последнего закрытого дня, НЕ вся история."""
    ingest_records(session, parse_records([
        make_raw(**{'ItemSaleEvent.Id': '11111111-0000-0000-0000-000000000001',
                    'OpenDate.Typed': '2026-05-20', 'DishName': 'Майская'}),
        make_raw(**{'ItemSaleEvent.Id': '11111111-0000-0000-0000-000000000002',
                    'OpenDate.Typed': '2026-06-10', 'DishName': 'Июньская',
                    'SessionNum': 875}),
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_sales(session, restaurant.id)
    assert [p.name for p in page.positions] == ['Июньская']   # май не протёк
    assert page.period.label == '01.06 — 10.06.2026'          # эффективные границы


def test_dates_are_clamped_to_data_bounds(session, restaurant):
    """Явные даты усекаются краями данных: будущее и «глубже истории»."""
    ingest_records(session, parse_records([RAW]), restaurant_id=restaurant.id)  # 22.06
    session.commit()

    page = build_sales(session, restaurant.id,
                       date(2020, 1, 1), date(2030, 1, 1))
    assert [p.name for p in page.positions] == ['Контейнер']
    assert page.period.label == '22.06 — 22.06.2026'


def test_period_outside_data_gives_empty_page(session, restaurant):
    ingest_records(session, parse_records([RAW]), restaurant_id=restaurant.id)  # 22.06
    session.commit()

    page = build_sales(session, restaurant.id,
                       date(2026, 8, 1), date(2026, 8, 31))
    assert page.positions == []
    assert page.period.label == 'Нет данных за период'


def test_positions_aggregate_and_map(session, restaurant):
    ingest_records(session, parse_records([
        RAW,                                                     # Контейнер, папка Кухня -> k
        make_raw(**{'ItemSaleEvent.Id': '11111111-2222-3333-4444-555555555555',
                    'DishName': 'Контейнер'}),                   # вторая продажа того же блюда
        make_raw(**{'ItemSaleEvent.Id': '22222222-3333-4444-5555-666666666666',
                    'DishName': 'Негрони', 'DishCategory': 'Коктейли алк.',
                    'DishGroup.TopParent': 'Бар',
                    'DishSumInt': 650, 'DishDiscountSumInt': 650}),
        make_raw(**{'ItemSaleEvent.Id': '44444444-5555-6666-7777-888888888888',
                    'DishName': 'Кальян', 'DishCategory': 'Кальяны',
                    'DishGroup.TopParent': 'Кальяны',            # группа в корне, вне папок
                    'DishSumInt': 1500, 'DishDiscountSumInt': 1500}),
        make_raw(**{'ItemSaleEvent.Id': '55555555-6666-7777-8888-999999999999',
                    'DishName': 'Мохито', 'DishCategory': 'Коктейли безалк.',
                    'DishGroup.TopParent': 'БАР',                # неканоничный регистр
                    'DishSumInt': 450, 'DishDiscountSumInt': 450}),
        make_raw(**{'ItemSaleEvent.Id': '33333333-4444-5555-6666-777777777777',
                    'DishName': 'Проработка супа', 'DishSumInt': 0,
                    'DishDiscountSumInt': 0}),                   # нулевая -> отфильтрована
    ]), restaurant_id=restaurant.id)
    session.commit()

    page = build_sales(session, restaurant.id)
    by_name = {p.name: p for p in page.positions}

    assert set(by_name) == {'Контейнер', 'Негрони', 'Кальян', 'Мохито'}  # проработка не попала
    assert by_name['Контейнер'].qty == 2
    # v2-факты: суммы как в БД, без восстановления из средних
    assert by_name['Контейнер'].revenue == 50.0       # 25 + 25 фактических оплат
    assert by_name['Контейнер'].cost == pytest.approx(21.24)  # 10.619 * 2, округлено
    # legacy-средние (мост до миграции фронта): производные тех же сумм
    assert by_name['Контейнер'].price == 25.0         # revenue / qty
    assert by_name['Контейнер'].cat == 'k'            # юнит = папка 1-го уровня
    assert by_name['Негрони'].cat == 'b'
    assert by_name['Кальян'].cat == 'o'               # вне папок -> вне подразделений
    assert by_name['Мохито'].cat == 'b'               # 'БАР' капсом -> терпимость к регистру
