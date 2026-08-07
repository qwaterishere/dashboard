"""GET /api/attention — контракт, границы порогов, partial domains."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from src.schemas.attention import AttentionResponse, DomainStatus
from src.schemas.stock import NegativeStock
from src.services.attention import PACE_RISK_RATIO, build_attention
from src.services.stock import SnapshotNotFound
from tests.conftest import DEV_ORIGIN


def _restaurant(**kwargs):
    from src.db.models.restaurant import Restaurant

    return Restaurant(
        id=uuid4(),
        user_id=uuid4(),
        timezone="Asia/Bishkek",
        **kwargs,
    )


def test_attention_requires_auth(client):
    client.cookies.clear()
    response = client.get("/api/attention", headers={"Origin": DEV_ORIGIN})
    assert response.status_code in (401, 403)


def test_attention_schema_ok(client):
    response = client.get("/api/attention", headers={"Origin": DEV_ORIGIN})
    assert response.status_code == 200
    AttentionResponse.model_validate(response.json())


def test_build_attention_negative_stock(monkeypatch):
    restaurant = _restaurant()
    session = MagicMock()

    from src.services import attention as mod

    monkeypatch.setattr(
        mod,
        "expected_closed_sales_day",
        lambda _tz, now=None: date(2026, 7, 22),
    )
    monkeypatch.setattr(
        mod,
        "stock_negative",
        lambda *_a, **_k: NegativeStock(count=3, valueAbs=12_400.0),
    )
    monkeypatch.setattr(
        mod,
        "_foodcost_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_revenue_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_targets_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )

    payload = build_attention(session, restaurant)
    assert payload.domains.stock == DomainStatus.ready
    assert payload.negativeStock is not None
    assert payload.negativeStock.count == 3
    assert payload.asOf == date(2026, 7, 22)
    assert payload.period.year == 2026
    assert payload.period.month == 7


def test_build_attention_stock_empty(monkeypatch):
    restaurant = _restaurant()
    session = MagicMock()

    from src.services import attention as mod

    monkeypatch.setattr(
        mod,
        "expected_closed_sales_day",
        lambda _tz, now=None: date(2026, 7, 22),
    )
    monkeypatch.setattr(
        mod,
        "stock_negative",
        lambda *_a, **_k: (_ for _ in ()).throw(SnapshotNotFound("none")),
    )
    monkeypatch.setattr(
        mod,
        "_foodcost_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_revenue_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_targets_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )

    payload = build_attention(session, restaurant)
    assert payload.domains.stock == DomainStatus.empty
    assert payload.negativeStock is None


def test_pace_risk_boundary():
    """Документируем канон: fact < pace * 0.98 → risk."""
    pace = 1000.0
    assert 979.0 < pace * PACE_RISK_RATIO
    assert 980.0 == pace * PACE_RISK_RATIO
    fact_risk = 979.0
    fact_ok = 980.0
    assert fact_risk < pace * PACE_RISK_RATIO
    assert not (fact_ok < pace * PACE_RISK_RATIO)


def test_build_attention_passes_restaurant_id(monkeypatch):
    """Tenant boundary: stock builder receives the current restaurant id."""
    restaurant = _restaurant()
    session = MagicMock()
    seen: list = []

    from src.services import attention as mod

    monkeypatch.setattr(
        mod,
        "expected_closed_sales_day",
        lambda _tz, now=None: date(2026, 7, 22),
    )

    def fake_stock(session_arg, restaurant_id, **_k):
        seen.append(restaurant_id)
        return NegativeStock(count=0, valueAbs=0.0)

    monkeypatch.setattr(mod, "stock_negative", fake_stock)
    monkeypatch.setattr(
        mod,
        "_foodcost_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_revenue_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_targets_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )

    build_attention(session, restaurant)
    assert seen == [restaurant.id]


def test_build_attention_foodcost_over_goal(monkeypatch):
    restaurant = _restaurant()
    session = MagicMock()

    from src.schemas.attention import FoodcostAttentionFacts
    from src.services import attention as mod

    monkeypatch.setattr(
        mod,
        "expected_closed_sales_day",
        lambda _tz, now=None: date(2026, 7, 22),
    )
    monkeypatch.setattr(
        mod,
        "_stock_domain",
        lambda *_a, **_k: (DomainStatus.empty, None),
    )
    monkeypatch.setattr(
        mod,
        "_foodcost_domain",
        lambda *_a, **_k: (
            DomainStatus.ready,
            FoodcostAttentionFacts(
                cleanPct=32.0,
                cleanGoal=28.0,
                cleanGoalConfigured=True,
                overGoal=True,
                complimentsFact=0,
                complimentsGoal=1000,
                complimentsOver=False,
            ),
        ),
    )
    monkeypatch.setattr(
        mod,
        "_revenue_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_targets_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )

    payload = build_attention(session, restaurant)
    assert payload.foodcost is not None
    assert payload.foodcost.overGoal is True


def test_build_attention_month_plan_false(monkeypatch):
    restaurant = _restaurant()
    session = MagicMock()

    from src.schemas.attention import MonthPlanFacts
    from src.services import attention as mod

    monkeypatch.setattr(
        mod,
        "expected_closed_sales_day",
        lambda _tz, now=None: date(2026, 7, 22),
    )
    monkeypatch.setattr(
        mod,
        "_stock_domain",
        lambda *_a, **_k: (DomainStatus.empty, None),
    )
    monkeypatch.setattr(
        mod,
        "_foodcost_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_revenue_domain",
        lambda *_a, **_k: (DomainStatus.ready, None),
    )
    monkeypatch.setattr(
        mod,
        "_targets_domain",
        lambda *_a, **_k: (DomainStatus.ready, MonthPlanFacts(configured=False)),
    )

    payload = build_attention(session, restaurant)
    assert payload.monthPlan is not None
    assert payload.monthPlan.configured is False


def test_attention_resource_registry():
    from src.schemas.resource_registry import SCHEMA_REGISTRY, validate_resource

    assert "attention" in SCHEMA_REGISTRY
    sample = {
        "asOf": "2026-07-22",
        "period": {"year": 2026, "month": 7},
        "domains": {
            "stock": "ready",
            "foodcost": "ready",
            "revenue": "ready",
            "targets": "ready",
        },
        "negativeStock": {"count": 0, "valueAbs": 0},
        "foodcost": {
            "cleanPct": 25.0,
            "cleanGoal": 28.0,
            "cleanGoalConfigured": True,
            "overGoal": False,
            "complimentsFact": 0,
            "complimentsGoal": 1000,
            "complimentsOver": False,
        },
        "revenuePace": {"risk": False, "fact": 100, "pace": 100},
        "monthPlan": {"configured": True},
    }
    validate_resource("attention", sample)


@pytest.mark.parametrize(
    "extra",
    [{"evil": True}, {"domains": {"stock": "ready", "foodcost": "ready", "revenue": "ready", "targets": "ready", "x": "ready"}}],
)
def test_attention_schema_forbids_extra(extra):
    base = {
        "asOf": "2026-07-22",
        "period": {"year": 2026, "month": 7},
        "domains": {
            "stock": "empty",
            "foodcost": "error",
            "revenue": "insufficient",
            "targets": "ready",
        },
    }
    with pytest.raises(Exception):
        AttentionResponse.model_validate({**base, **extra})
