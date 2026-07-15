"""Тесты сборки страницы «Фудкост» (фаза 1): правило №3, скидки, потери."""

from datetime import date

import pytest

from src.db.session import DataBaseManager, Base
from src.schemas.foodcost import Foodcost
from src.services.foodcost import build_food_cost
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


def _dish(day: str, order: int, uid: str, *, paid: float, price: float,
          cost: float | None, discount: float = 0,
          top: str = 'Кухня', group: str = 'Горячее'):
    return make_raw(**{
        'ItemSaleEvent.Id': uid, 'OpenDate.Typed': day, 'OrderNum': order,
        'SessionNum': 900,
        'DishSumInt': price, 'DishDiscountSumInt': paid,
        'DiscountSum': discount,
        'ProductCostBase.ProductCost': cost,
        'DishGroup.TopParent': top, 'DishGroup': group,
    })


def _load(session, restaurant, records):
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()


CURRENT = [
    # обычное блюдо: и в выручке, и в фудкосте
    _dish('2026-06-10', 1, '11111111-0000-0000-0000-000000000001',
          paid=1000, price=1000, cost=300),
    # бизнес-ланч без техкарты: в выручке есть, фудкост не размывает (№3)
    _dish('2026-06-10', 2, '11111111-0000-0000-0000-000000000002',
          paid=500, price=500, cost=0, group='Ланчи'),
    # комплимент: не выручка и не фудкост — только losses
    _dish('2026-06-10', 3, '11111111-0000-0000-0000-000000000003',
          paid=0, price=520, cost=150, group='Десерты'),
    # скидочная позиция бара
    _dish('2026-06-10', 4, '11111111-0000-0000-0000-000000000004',
          paid=280, price=350, cost=48, discount=70, top='Бар', group='Кофе'),
]
PREV = [
    _dish('2026-05-05', 5, '22222222-0000-0000-0000-000000000001',
          paid=400, price=400, cost=100),
]


def test_rule3_blocks_and_lfl(session, restaurant):
    _load(session, restaurant, CURRENT + PREV)

    page = build_food_cost(session, restaurant.id)
    assert isinstance(page, Foodcost)

    # тоталы: revenue по paid>0; cost и знаменатель — только по строкам cost>0
    assert page.totals.revenue == 1780            # 1000 + 500 + 280
    assert page.totals.cost == 348                # 300 + 48 (ланч и комплимент — нет)
    assert page.totals.revenueWithCost == 1280    # 1000 + 280
    assert page.totals.prevRevenue == 400
    assert page.totals.prevCost == 100
    assert page.totals.prevRevenueWithCost == 400
    assert page.totals.goal is None
    assert page.dirty is None

    # юниты: всегда 4 ключа в порядке k/b/w/o, тоталы = их сумма
    assert [u.key for u in page.units] == ['k', 'b', 'w', 'o']
    by_key = {u.key: u for u in page.units}
    assert by_key['k'].revenue == 1500 and by_key['k'].cost == 300
    assert by_key['k'].revenueWithCost == 1000    # ланч выпал из знаменателя
    assert by_key['b'].revenue == 280 and by_key['b'].cost == 48
    assert by_key['w'].revenue == 0
    assert page.totals.revenue == sum(u.revenue for u in page.units)

    # группы: только с продажами; «Десерты» (один комплимент) не попали
    names = {g.group for g in page.groups}
    assert names == {'Горячее', 'Ланчи', 'Кофе'}
    horyachee = next(g for g in page.groups if g.group == 'Горячее')
    assert horyachee.unit == 'k' and horyachee.revenue == 1000
    # сортировка по выручке: первым — самая большая группа
    assert page.groups[0].group == 'Горячее'

    # скидки: пять чисел по скидочным строкам
    assert page.discounts.discountSum == 70
    assert page.discounts.discountedRevenue == 280
    assert page.discounts.discountedRevenueWithCost == 280
    assert page.discounts.discountSumWithCost == 70
    assert page.discounts.discountedCost == 48

    # потери: комплимент целиком здесь; staff — нули до решения
    assert page.losses.compliments.cost == 150
    assert page.losses.compliments.priceValue == 520
    assert page.losses.compliments.qty == 1
    assert page.losses.staff.paidSum == 0
    assert page.losses.writeoffs is None


def test_no_compare_gives_null_prev(session, restaurant):
    _load(session, restaurant, CURRENT)          # compare-периода нет

    page = build_food_cost(session, restaurant.id)
    assert page.totals.prevRevenue is None       # сравнивать не с чем
    assert page.units[0].prevRevenue is None
    assert page.groups[0].prevRevenue is None


def test_empty_db_gives_typed_zeros(session, restaurant):
    page = build_food_cost(session, restaurant.id)
    assert isinstance(page, Foodcost)
    assert page.totals.revenue == 0
    assert page.totals.prevRevenue is None
    assert [u.key for u in page.units] == ['k', 'b', 'w', 'o']
    assert page.groups == []


def test_tenant_isolation(session, restaurant):
    _load(session, restaurant, CURRENT)
    stranger = create_restaurant(session)   # фабрика сама даёт уникальный email

    page = build_food_cost(session, stranger.id)
    assert page.totals.revenue == 0              # чужие продажи не видны
