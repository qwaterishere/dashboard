"""Data freshness status and auto-sync scheduler."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest

from src.db.models.restaurant import Restaurant
from src.services.data_freshness import (
    build_data_freshness,
    expected_closed_sales_day,
    resolve_restaurant_timezone,
)
from src.services.iiko_sync_scheduler import should_auto_sync
from tests.conftest import DEV_ORIGIN, TEST_USER


def _restaurant(**kwargs) -> Restaurant:
    return Restaurant(id=uuid4(), user_id=uuid4(), **kwargs)


def test_expected_closed_sales_day_uses_restaurant_tz():
    tz = resolve_restaurant_timezone("Asia/Bishkek")
    now = datetime(2026, 3, 2, 20, 0, tzinfo=UTC)
    assert expected_closed_sales_day(tz, now=now) == date(2026, 3, 2)


def test_build_data_freshness_fresh():
    restaurant = _restaurant(
        iiko_url="https://demo.iiko.it:443",
        iiko_login="api",
        iiko_password_encrypted="enc",
        sync_status="success",
        auto_sync_enabled=True,
        timezone="Asia/Bishkek",
    )
    now = datetime(2026, 3, 2, 12, 0, tzinfo=UTC)
    expected = expected_closed_sales_day(resolve_restaurant_timezone("Asia/Bishkek"), now=now)

    class FakeSession:
        def __init__(self):
            self.restaurant = restaurant

    session = FakeSession()

    from src.services import data_freshness as mod

    original = mod._data_bounds
    mod._data_bounds = lambda _session, _rid: (date(2026, 1, 1), expected)
    try:
        payload = build_data_freshness(session, restaurant, now=now)  # type: ignore[arg-type]
    finally:
        mod._data_bounds = original

    assert payload.status == "fresh"
    assert payload.lagDays == 0
    assert payload.latestSalesDay == expected


def test_build_data_freshness_stale_when_behind():
    restaurant = _restaurant(
        iiko_url="https://demo.iiko.it:443",
        iiko_login="api",
        iiko_password_encrypted="enc",
        sync_status="idle",
        auto_sync_enabled=True,
    )
    now = datetime(2026, 3, 5, 12, 0, tzinfo=UTC)

    from src.services import data_freshness as mod

    original = mod._data_bounds
    mod._data_bounds = lambda _session, _rid: (date(2026, 1, 1), date(2026, 3, 1))
    try:
        payload = build_data_freshness(None, restaurant, now=now)  # type: ignore[arg-type]
    finally:
        mod._data_bounds = original

    assert payload.status == "stale"
    assert payload.lagDays == 3


def test_should_auto_sync_when_plan_pending(monkeypatch):
    restaurant = _restaurant(
        iiko_url="https://demo.iiko.it:443",
        iiko_login="api",
        iiko_password_encrypted="enc",
        sync_status="idle",
        auto_sync_enabled=True,
    )

    class FakePlan:
        date_from = date(2026, 3, 1)
        date_to = date(2026, 3, 4)

    monkeypatch.setattr(
        "src.services.iiko_sync_scheduler.resolve_sync_plan",
        lambda *_args, **_kwargs: FakePlan(),
    )

    should, reason = should_auto_sync(None, restaurant)  # type: ignore[arg-type]
    assert should is True
    assert reason == "pending_data"


def test_data_freshness_endpoint(client):
    response = client.get("/api/data-freshness", headers={"Origin": DEV_ORIGIN})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {
        "fresh",
        "stale",
        "stale_manual",
        "syncing",
        "error",
        "empty",
        "unconfigured",
    }
    assert "expectedDay" in body


@pytest.mark.no_auth
def test_internal_sync_requires_token(client, monkeypatch):
    from src.api import deps
    from src.core.config import get_settings

    monkeypatch.setattr(
        deps,
        "get_settings",
        lambda: get_settings().model_copy(update={"sync_scheduler_token": None}),
    )

    response = client.post("/api/internal/iiko/sync", json={})
    assert response.status_code == 503


@pytest.mark.no_auth
def test_internal_sync_rejects_missing_bearer(client, monkeypatch):
    from src.core.config import get_settings

    monkeypatch.setenv("SYNC_SCHEDULER_TOKEN", "test-scheduler-token-32chars-min")
    get_settings.cache_clear()

    response = client.post("/api/internal/iiko/sync", json={})
    assert response.status_code == 401

    get_settings.cache_clear()


@pytest.mark.no_auth
def test_internal_sync_with_token(client, monkeypatch):
    from src.core.config import get_settings

    monkeypatch.setenv("SYNC_SCHEDULER_TOKEN", "test-scheduler-token-32chars-min")
    get_settings.cache_clear()

    monkeypatch.setattr(
        "src.api.routes.internal.run_scheduled_syncs",
        lambda **kwargs: [],
    )

    response = client.post(
        "/api/internal/iiko/sync",
        json={},
        headers={"Authorization": "Bearer test-scheduler-token-32chars-min"},
    )
    assert response.status_code == 200
    assert response.json()["outcomes"] == []

    get_settings.cache_clear()
