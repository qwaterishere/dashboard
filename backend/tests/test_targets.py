"""Targets plan distribution + persistence wiring into dashboard/foodcost."""

from __future__ import annotations

from src.db.session import Base, DataBaseManager
from src.schemas.targets import (
    TargetsFoodcostUnit,
    TargetsRevenue,
    TargetsUpsertRequest,
    TargetsWriteoffUnit,
)
from src.services.dashboard import build_dashboard
from src.services.foodcost import build_food_cost
from src.services.sales import ingest_records, parse_records
from src.services.targets import build_targets, save_targets
from src.services.targets_plan import build_month_day_plans
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw

import pytest


@pytest.fixture()
def session():
    manager = DataBaseManager("sqlite:///:memory:")
    Base.metadata.create_all(manager.engine)
    db = manager.get_session()
    yield db
    db.close()


@pytest.fixture()
def restaurant(session):
    return create_restaurant(session)


def test_build_month_day_plans_respects_week_profile_and_overrides():
    plans = build_month_day_plans(
        2026,
        8,
        310_000,
        [1, 1, 1, 1, 1, 2, 2],
        overrides={1: 50_000},
    )
    assert plans[0].amount == 50_000
    assert plans[0].is_override is True
    assert sum(p.amount for p in plans) == 310_000
    assert all(p.amount >= 0 for p in plans)


def test_save_and_load_targets_no_inheritance(session, restaurant):
    from src.services.targets import DEFAULT_FOODCOST_GOALS, DEFAULT_REVENUE_MONTH_PLAN

    empty = build_targets(session, restaurant.id, year=2026, month=8)
    assert empty.revenue.monthPlan == DEFAULT_REVENUE_MONTH_PLAN
    assert empty.foodcost[0].goalPct == DEFAULT_FOODCOST_GOALS["k"]
    assert empty.dailyOverrides == {}

    saved = save_targets(
        session,
        restaurant.id,
        TargetsUpsertRequest(
            year=2026,
            month=8,
            revenue=TargetsRevenue(
                monthPlan=3_100_000,
                weekProfile=[1, 1, 1, 1, 1, 1.2, 1.1],
            ),
            dailyOverrides={"5": 200_000},
            foodcost=[
                TargetsFoodcostUnit(key="k", name="Кухня", goalPct=30, factPct=0),
                TargetsFoodcostUnit(key="b", name="Бар", goalPct=24, factPct=0),
            ],
            writeoffs=[
                TargetsWriteoffUnit(key="k", name="Кухня", mode="pct", pct=1.0, rub=0),
            ],
            complimentsGoalPct=0.5,
            inventoryGoalPct=0.1,
        ),
    )
    assert saved.revenue.monthPlan == 3_100_000
    assert saved.dailyOverrides["5"] == 200_000
    assert saved.foodcost[0].goalPct == 30

    # соседний месяц без сохранения — снова шаблон, не значения августа
    september = build_targets(session, restaurant.id, year=2026, month=9)
    assert september.revenue.monthPlan == DEFAULT_REVENUE_MONTH_PLAN
    assert september.dailyOverrides == {}
    assert september.foodcost[0].goalPct == DEFAULT_FOODCOST_GOALS["k"]


def test_dashboard_uses_default_plans_without_save(session, restaurant):
    from src.services.targets import DEFAULT_REVENUE_MONTH_PLAN

    ingest_records(
        session,
        parse_records(
            [
                make_raw(
                    **{
                        "ItemSaleEvent.Id": "cccccccc-0000-0000-0000-000000000001",
                        "OpenDate.Typed": "2026-08-05",
                        "OrderNum": 1,
                        "SessionNum": 1,
                        "GuestNum": 2,
                        "DishSumInt": 1000,
                        "DishDiscountSumInt": 1000,
                    }
                )
            ]
        ),
        restaurant_id=restaurant.id,
    )
    session.commit()

    page = build_dashboard(session, restaurant.id, year=2026, month=8)
    assert page.revenueByDay[0].plan is not None
    assert page.revenueByDay[0].plan > 0
    assert page.kpis.revenue.forecast == DEFAULT_REVENUE_MONTH_PLAN


def test_dashboard_revenue_day_plan_from_targets(session, restaurant):
    ingest_records(
        session,
        parse_records(
            [
                make_raw(
                    **{
                        "ItemSaleEvent.Id": "aaaaaaaa-0000-0000-0000-000000000001",
                        "OpenDate.Typed": "2026-08-05",
                        "OrderNum": 1,
                        "SessionNum": 1,
                        "GuestNum": 2,
                        "DishSumInt": 1000,
                        "DishDiscountSumInt": 1000,
                    }
                )
            ]
        ),
        restaurant_id=restaurant.id,
    )
    session.commit()

    save_targets(
        session,
        restaurant.id,
        TargetsUpsertRequest(
            year=2026,
            month=8,
            revenue=TargetsRevenue(
                monthPlan=3_100_000,
                weekProfile=[1, 1, 1, 1, 1, 1, 1],
            ),
            dailyOverrides={},
            foodcost=[],
            writeoffs=[],
            complimentsGoalPct=0,
            inventoryGoalPct=0,
        ),
    )

    page = build_dashboard(session, restaurant.id, year=2026, month=8)
    assert page.revenueByDay
    assert page.revenueByDay[0].plan is not None
    assert page.revenueByDay[0].plan > 0
    assert page.kpis.revenue.forecast == 3_100_000
    assert page.kpis.revenue.forecastToday is not None
    assert page.kpis.revenue.forecastToday > 0


def test_foodcost_goals_from_targets(session, restaurant):
    ingest_records(
        session,
        parse_records(
            [
                make_raw(
                    **{
                        "ItemSaleEvent.Id": "bbbbbbbb-0000-0000-0000-000000000001",
                        "OpenDate.Typed": "2026-08-05",
                        "OrderNum": 1,
                        "SessionNum": 1,
                        "GuestNum": 2,
                        "DishSumInt": 1000,
                        "DishDiscountSumInt": 1000,
                        "ProductCostBase.ProductCost": 300,
                        "DishGroup.TopParent": "Кухня",
                    }
                )
            ]
        ),
        restaurant_id=restaurant.id,
    )
    session.commit()

    save_targets(
        session,
        restaurant.id,
        TargetsUpsertRequest(
            year=2026,
            month=8,
            revenue=TargetsRevenue(
                monthPlan=1_000_000,
                weekProfile=[1, 1, 1, 1, 1, 1, 1],
            ),
            dailyOverrides={},
            foodcost=[
                TargetsFoodcostUnit(key="k", name="Кухня", goalPct=30, factPct=0),
                TargetsFoodcostUnit(key="b", name="Бар", goalPct=20, factPct=0),
            ],
            writeoffs=[
                TargetsWriteoffUnit(key="k", name="Кухня", mode="pct", pct=1.0, rub=0),
                TargetsWriteoffUnit(key="b", name="Бар", mode="rub", pct=0, rub=25_000),
            ],
            complimentsGoalPct=0.5,
            inventoryGoalPct=0.1,
        ),
    )

    page = build_food_cost(session, restaurant.id, year=2026, month=8)
    assert page.units[0].goal == 30  # кухня
    assert page.losses.writeoffsGoal == 35_000  # 1% of 1M + 25k
    assert page.losses.complimentsGoal == 5_000


def test_api_targets_get_put(client):
    get_response = client.get("/api/targets?year=2026&month=8")
    assert get_response.status_code == 200
    body = get_response.json()
    assert body["period"]["year"] == 2026
    assert body["period"]["month"] == 8
    assert "dailyOverrides" in body

    put_response = client.put(
        "/api/targets",
        json={
            "year": 2026,
            "month": 8,
            "revenue": {"monthPlan": 5_000_000, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
            "dailyOverrides": {"2": 150000},
            "foodcost": [
                {"key": "k", "name": "Кухня", "goalPct": 29, "factPct": 0},
                {"key": "b", "name": "Бар", "goalPct": 22, "factPct": 0},
            ],
            "writeoffs": [
                {"key": "k", "name": "Кухня", "mode": "pct", "pct": 1.2, "rub": 0},
                {"key": "b", "name": "Бар", "mode": "rub", "pct": 0, "rub": 50000},
            ],
            "complimentsGoalPct": 0.4,
            "inventoryGoalPct": 0.15,
        },
    )
    assert put_response.status_code == 200
    saved = put_response.json()
    assert saved["revenue"]["monthPlan"] == 5_000_000
    assert saved["dailyOverrides"]["2"] == 150000
    assert saved["foodcost"][0]["goalPct"] == 29

    again = client.get("/api/targets?year=2026&month=8").json()
    assert again["revenue"]["monthPlan"] == 5_000_000
    assert again["inventory"]["goalPct"] == 0.15
