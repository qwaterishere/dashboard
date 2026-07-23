"""Targets plan distribution + persistence wiring into dashboard/foodcost."""

from __future__ import annotations

from src.db.session import Base, DataBaseManager
from src.schemas.targets import TargetsUpsertRequest
from src.services.dashboard import build_dashboard
from src.services.foodcost import build_food_cost
from src.services.sales import ingest_records, parse_records
from src.services.targets import build_targets, save_targets
from src.services.targets_plan import build_month_day_plans
from tests.factories import create_restaurant
from tests.sales.test_ingest import make_raw

import pytest


def _upsert(**overrides):
    payload = {
        "year": 2026,
        "month": 8,
        "revenue": {"monthPlan": 3_100_000, "weekProfile": [1, 1, 1, 1, 1, 1.2, 1.1]},
        "dailyOverrides": {},
        "foodcost": [
            {"key": "k", "name": "Кухня", "goalPct": 30, "factPct": 0},
            {"key": "b", "name": "Бар", "goalPct": 24, "factPct": 0},
        ],
        "writeoffs": [
            {"key": "k", "name": "Кухня", "mode": "pct", "pct": 1.0, "rub": 0},
            {"key": "b", "name": "Бар", "mode": "pct", "pct": 0.8, "rub": 0},
        ],
        "complimentsGoalPct": 0.5,
        "inventoryGoalPct": 0.1,
    }
    payload.update(overrides)
    return TargetsUpsertRequest.model_validate(payload)


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
    empty = build_targets(session, restaurant.id, year=2026, month=8)
    assert empty.revenue.monthPlan == 0
    assert empty.foodcost[0].goalPct == 0
    assert empty.dailyOverrides == {}

    saved = save_targets(
        session,
        restaurant.id,
        _upsert(dailyOverrides={"5": 200_000}),
    )
    assert saved.revenue.monthPlan == 3_100_000
    assert saved.dailyOverrides["5"] == 200_000
    assert saved.foodcost[0].goalPct == 30

    # соседний месяц без сохранения — пустой, без наследования
    september = build_targets(session, restaurant.id, year=2026, month=9)
    assert september.revenue.monthPlan == 0
    assert september.dailyOverrides == {}
    assert september.foodcost[0].goalPct == 0


def test_api_targets_put_rejects_incomplete_payload(client):
    response = client.put(
        "/api/targets",
        json={
            "year": 2026,
            "month": 8,
            "revenue": {"monthPlan": 0, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
            "dailyOverrides": {},
            "foodcost": [{"key": "k", "name": "Кухня", "goalPct": 30, "factPct": 0}],
            "writeoffs": [{"key": "k", "name": "Кухня", "mode": "pct", "pct": 1.2, "rub": 0}],
            "complimentsGoalPct": 0.4,
            "inventoryGoalPct": 0.15,
        },
    )
    assert response.status_code == 422


def test_clear_targets_removes_month_and_dashboard_plans(session, restaurant):
    save_targets(session, restaurant.id, _upsert(dailyOverrides={"5": 200_000}))
    assert build_targets(session, restaurant.id, year=2026, month=8).revenue.monthPlan == 3_100_000

    from src.services.targets import clear_targets

    cleared = clear_targets(session, restaurant.id, year=2026, month=8)
    assert cleared.revenue.monthPlan == 0
    assert cleared.dailyOverrides == {}

    ingest_records(
        session,
        parse_records(
            [
                make_raw(
                    **{
                        "ItemSaleEvent.Id": "dddddddd-0000-0000-0000-000000000001",
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
    assert page.revenueByDay[0].plan is None


def test_api_targets_delete(client):
    put = client.put(
        "/api/targets",
        json={
            "year": 2026,
            "month": 8,
            "revenue": {"monthPlan": 5_000_000, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
            "dailyOverrides": {},
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
    assert put.status_code == 200

    deleted = client.delete("/api/targets?year=2026&month=8")
    assert deleted.status_code == 200
    body = deleted.json()
    assert body["revenue"]["monthPlan"] == 0
    assert body["dailyOverrides"] == {}


def test_dashboard_has_no_plans_without_saved_targets(session, restaurant):
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
    assert page.revenueByDay[0].plan is None
    # без целей — статистический прогноз (не готов при <7 днях)
    assert page.kpis.revenue.forecast is None


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
        _upsert(
            revenue={"monthPlan": 3_100_000, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
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
        _upsert(
            revenue={"monthPlan": 1_000_000, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
            foodcost=[
                {"key": "k", "name": "Кухня", "goalPct": 30, "factPct": 0},
                {"key": "b", "name": "Бар", "goalPct": 20, "factPct": 0},
            ],
            writeoffs=[
                {"key": "k", "name": "Кухня", "mode": "pct", "pct": 1.0, "rub": 0},
                {"key": "b", "name": "Бар", "mode": "rub", "pct": 0, "rub": 25_000},
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
    assert body["revenue"]["monthPlan"] == 0
    assert "dailyOverrides" in body
    assert body["dailyOverrides"] == {}

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
    assert again["locked"] is False


def test_api_targets_lock_blocks_put_and_delete(client):
    put = client.put(
        "/api/targets",
        json={
            "year": 2026,
            "month": 8,
            "revenue": {"monthPlan": 5_000_000, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
            "dailyOverrides": {},
            "foodcost": [
                {"key": "k", "name": "Кухня", "goalPct": 29, "factPct": 0},
                {"key": "b", "name": "Бар", "goalPct": 22, "factPct": 0},
            ],
            "writeoffs": [
                {"key": "k", "name": "Кухня", "mode": "pct", "pct": 1.2, "rub": 0},
                {"key": "b", "name": "Бар", "mode": "pct", "pct": 0.8, "rub": 0},
            ],
            "complimentsGoalPct": 0.4,
            "inventoryGoalPct": 0.15,
        },
    )
    assert put.status_code == 200

    locked = client.post("/api/targets/lock?year=2026&month=8")
    assert locked.status_code == 200
    assert locked.json()["locked"] is True

    blocked_put = client.put(
        "/api/targets",
        json={
            "year": 2026,
            "month": 8,
            "revenue": {"monthPlan": 6_000_000, "weekProfile": [1, 1, 1, 1, 1, 1, 1]},
            "dailyOverrides": {},
            "foodcost": [
                {"key": "k", "name": "Кухня", "goalPct": 29, "factPct": 0},
                {"key": "b", "name": "Бар", "goalPct": 22, "factPct": 0},
            ],
            "writeoffs": [
                {"key": "k", "name": "Кухня", "mode": "pct", "pct": 1.2, "rub": 0},
                {"key": "b", "name": "Бар", "mode": "pct", "pct": 0.8, "rub": 0},
            ],
            "complimentsGoalPct": 0.4,
            "inventoryGoalPct": 0.15,
        },
    )
    assert blocked_put.status_code == 409

    blocked_delete = client.delete("/api/targets?year=2026&month=8")
    assert blocked_delete.status_code == 409

    locks = client.get("/api/targets/locks")
    assert locks.status_code == 200
    assert locks.json()["items"] == [{"year": 2026, "month": 8, "label": "Август 2026"}]

    unlocked = client.post("/api/targets/unlock?year=2026&month=8")
    assert unlocked.status_code == 200
    assert unlocked.json()["locked"] is False

    assert client.delete("/api/targets?year=2026&month=8").status_code == 200


def test_api_targets_lock_rejects_empty_month(client):
    response = client.post("/api/targets/lock?year=2026&month=9")
    assert response.status_code == 422


def test_reference_uses_full_previous_month_not_mtd_slice(session, restaurant):
    """Подсказка «факт» — весь прошлый месяц, не срез 1…N по текущему MTD."""
    # Июль: продажи 1–31 (полный месяц). Август: закрыто по 12-е.
    # Раньше reference брал июль 1–12; теперь — весь июль.
    records = []
    for day, amount in ((1, 100_000), (12, 200_000), (31, 300_000)):
        records.append(
            make_raw(
                **{
                    "ItemSaleEvent.Id": f"eeeeeeee-0000-0000-0000-0000000000{day:02d}",
                    "OpenDate.Typed": f"2026-07-{day:02d}",
                    "OrderNum": day,
                    "SessionNum": 1,
                    "GuestNum": 2,
                    "DishSumInt": amount,
                    "DishDiscountSumInt": amount,
                }
            )
        )
    records.append(
        make_raw(
            **{
                "ItemSaleEvent.Id": "ffffffff-0000-0000-0000-000000000012",
                "OpenDate.Typed": "2026-08-12",
                "OrderNum": 12,
                "SessionNum": 1,
                "GuestNum": 2,
                "DishSumInt": 50_000,
                "DishDiscountSumInt": 50_000,
            }
        )
    )
    ingest_records(session, parse_records(records), restaurant_id=restaurant.id)
    session.commit()

    page = build_targets(session, restaurant.id, year=2026, month=8)
    assert page.reference.label == "июля"
    assert page.reference.revenueFact == 600_000  # 100k+200k+300k, не только 1–12
    assert page.reference.revenuePace == 600_000  # июль закрыт полностью
