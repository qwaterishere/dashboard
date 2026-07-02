"""Тесты сборки страницы «Продажи» из БД."""

import pytest

from src.database import DataBaseManager, Base
from src.sales.service import build_sales, ingest_records, parse_records
from tests.sales.test_ingest import RAW, make_raw


@pytest.fixture()
def session():
    manager = DataBaseManager('sqlite:///:memory:')
    Base.metadata.create_all(manager.engine)
    session = manager.get_session()
    yield session
    session.close()


def test_empty_db_gives_empty_page(session):
    page = build_sales(session)
    assert page.positions == []


def test_positions_aggregate_and_map(session):
    ingest_records(session, parse_records([
        RAW,                                                     # Контейнер, 25, Прочее -> k
        make_raw(**{'ItemSaleEvent.Id': '11111111-2222-3333-4444-555555555555',
                    'DishName': 'Контейнер'}),                   # вторая продажа того же блюда
        make_raw(**{'ItemSaleEvent.Id': '22222222-3333-4444-5555-666666666666',
                    'DishName': 'Негрони', 'DishCategory': 'Коктейли алк.',
                    'DishSumInt': 650, 'DishDiscountSumInt': 650}),
        make_raw(**{'ItemSaleEvent.Id': '33333333-4444-5555-6666-777777777777',
                    'DishName': 'Проработка супа', 'DishSumInt': 0,
                    'DishDiscountSumInt': 0}),                   # нулевая -> отфильтрована
    ]))
    session.commit()

    page = build_sales(session)
    by_name = {p.name: p for p in page.positions}

    assert set(by_name) == {'Контейнер', 'Негрони'}   # проработка не попала
    assert by_name['Контейнер'].qty == 2
    assert by_name['Контейнер'].price == 25.0         # среднее за единицу
    assert by_name['Негрони'].cat == 'b'              # маппинг категории
    assert by_name['Контейнер'].cat == 'k'
