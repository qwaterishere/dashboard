"""iiko sync API."""

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

import pytest

from src.db.models.restaurant import Restaurant
from src.db.session import db_manager
from src.services.iiko_sync import (
    claim_queued_sync,
    enqueue_sync,
    normalize_sync_status,
    sync_plan_day_count,
    sync_progress_percent,
)
from tests.conftest import DEV_ORIGIN, register_payload


def _auth_headers() -> dict[str, str]:
    return {"Origin": DEV_ORIGIN}


@pytest.mark.no_auth
def test_sync_requires_configured_iiko(client):
    creds = register_payload(email="iiko-sync-unconfigured@example.com")
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    response = client.post("/api/integrations/iiko/sync", headers=_auth_headers())
    assert response.status_code == 400
    assert response.json()["detail"]["message"] == "Configure iiko connection first"
    assert response.json()["detail"]["code"] == "iiko_not_configured"


@pytest.mark.no_auth
def test_sync_does_not_run_in_api_when_disabled(client, monkeypatch):
    """SYNC_RUN_IN_API=false: enqueue only; worker drains the queue."""
    monkeypatch.setenv("SYNC_RUN_IN_API", "false")
    from src.core.config import get_settings

    get_settings.cache_clear()

    creds = register_payload(email="iiko-sync-enqueue-only@example.com")
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("src.services.restaurant.IikoClient", FakeClient)
    client.put(
        "/api/integrations/iiko",
        json={
            "iiko_url": "https://demo.iiko.it:443",
            "iiko_login": "api",
            "iiko_password": "secret",
        },
        headers=_auth_headers(),
    )

    called: list[str] = []

    def fake_process(restaurant_id):
        called.append(str(restaurant_id))

    monkeypatch.setattr(
        "src.api.routes.integrations.process_queued_sync",
        fake_process,
    )

    response = client.post("/api/integrations/iiko/sync", headers=_auth_headers())
    assert response.status_code == 202
    assert response.json()["status"] == "pending"
    assert called == []

    status = client.get("/api/integrations/iiko").json()["sync"]
    assert status["status"] == "pending"

    get_settings.cache_clear()


@pytest.mark.no_auth
def test_sync_starts_background_job(client, monkeypatch):
    creds = register_payload(email="iiko-sync@example.com")
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("src.services.restaurant.IikoClient", FakeClient)

    client.put(
        "/api/integrations/iiko",
        json={
            "iiko_url": "https://demo.iiko.it:443",
            "iiko_login": "api",
            "iiko_password": "secret",
        },
        headers=_auth_headers(),
    )

    called: list[str] = []

    def fake_run_sync(restaurant_id, *, full=False):
        called.append(str(restaurant_id))

    monkeypatch.setattr("src.services.iiko_sync.run_sync_job", fake_run_sync)

    response = client.post("/api/integrations/iiko/sync", headers=_auth_headers())
    assert response.status_code == 202
    assert response.json()["status"] == "pending"
    assert called

    status = client.get("/api/integrations/iiko").json()["sync"]
    assert status["status"] in {"pending", "running", "success", "noop", "error"}


@pytest.mark.no_auth
def test_sync_conflict_when_already_queued(client, monkeypatch):
    creds = register_payload(email="iiko-sync-busy@example.com")
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("src.services.restaurant.IikoClient", FakeClient)
    client.put(
        "/api/integrations/iiko",
        json={
            "iiko_url": "https://demo.iiko.it:443",
            "iiko_login": "api",
            "iiko_password": "secret",
        },
        headers=_auth_headers(),
    )

    monkeypatch.setattr(
        "src.api.routes.integrations.process_queued_sync",
        lambda *_a, **_k: None,
    )

    first = client.post("/api/integrations/iiko/sync", headers=_auth_headers())
    assert first.status_code == 202
    second = client.post("/api/integrations/iiko/sync", headers=_auth_headers())
    assert second.status_code == 409
    assert second.json()["detail"]["code"] == "sync_in_progress"


def test_sync_progress_percent():
    restaurant = Restaurant(
        sync_status="running",
        sync_plan_from=date(2026, 1, 1),
        sync_plan_to=date(2026, 1, 10),
        sync_days_done=5,
    )
    assert sync_plan_day_count(date(2026, 1, 1), date(2026, 1, 10)) == 10
    assert sync_progress_percent(restaurant) == 50


def test_normalize_maps_queued_to_pending():
    restaurant = Restaurant(sync_status="queued")
    status, _ = normalize_sync_status(restaurant)
    assert status == "pending"
    restaurant.sync_status = "queued_full"
    status, _ = normalize_sync_status(restaurant)
    assert status == "pending"


def test_enqueue_and_claim_sync_roundtrip():
    session = db_manager.get_session()
    try:
        restaurant = Restaurant(
            id=uuid4(),
            user_id=uuid4(),
            iiko_url="https://demo.iiko.it",
            iiko_login="api",
            iiko_password_encrypted="x",
            sync_status="idle",
        )
        # Bypass encryption helper: mark configured via columns used by property.
        session.add(restaurant)
        session.commit()

        # Ensure iiko_configured is true — property checks all three fields.
        assert restaurant.iiko_configured

        assert enqueue_sync(session, restaurant.id, full=True) is True
        session.refresh(restaurant)
        assert restaurant.sync_status == "queued_full"
        assert enqueue_sync(session, restaurant.id, full=False) is False

        claimed, full = claim_queued_sync(session, restaurant.id)
        assert claimed is True
        assert full is True
        session.refresh(restaurant)
        assert restaurant.sync_status == "running"
        assert restaurant.sync_started_at is not None
    finally:
        session.close()


def test_enqueue_reclaims_stale_running():
    session = db_manager.get_session()
    try:
        restaurant = Restaurant(
            id=uuid4(),
            user_id=uuid4(),
            iiko_url="https://demo.iiko.it",
            iiko_login="api",
            iiko_password_encrypted="x",
            sync_status="running",
            sync_started_at=datetime.now(UTC) - timedelta(minutes=60),
        )
        session.add(restaurant)
        session.commit()

        assert enqueue_sync(session, restaurant.id, full=False) is True
        session.refresh(restaurant)
        assert restaurant.sync_status == "queued"
    finally:
        session.close()
