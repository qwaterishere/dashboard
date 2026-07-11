"""iiko sync API."""

from datetime import date

import pytest

from src.db.models.restaurant import Restaurant
from src.services.iiko_sync import sync_plan_day_count, sync_progress_percent
from tests.conftest import DEV_ORIGIN, TEST_USER


def _auth_headers() -> dict[str, str]:
    return {"Origin": DEV_ORIGIN}


@pytest.mark.no_auth
def test_sync_requires_configured_iiko(client):
    creds = {**TEST_USER, "email": "iiko-sync-unconfigured@example.com"}
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    response = client.post("/api/auth/me/iiko/sync", headers=_auth_headers())
    assert response.status_code == 400
    assert response.json()["detail"] == "Configure iiko connection first"


@pytest.mark.no_auth
def test_sync_starts_background_job(client, monkeypatch):
    creds = {**TEST_USER, "email": "iiko-sync@example.com"}
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
        "/api/auth/me/iiko",
        json={
            "iiko_url": "https://demo.iiko.it:443",
            "iiko_login": "api",
            "iiko_password": "secret",
        },
        headers=_auth_headers(),
    )

    called: list[str] = []

    def fake_run_sync(restaurant_id):
        called.append(str(restaurant_id))

    monkeypatch.setattr("src.services.iiko_sync.run_sync_job", fake_run_sync)

    response = client.post("/api/auth/me/iiko/sync", headers=_auth_headers())
    assert response.status_code == 202
    assert response.json()["status"] == "running"
    assert called

    status = client.get("/api/auth/me/iiko").json()["sync"]
    assert status["status"] in {"running", "success", "noop", "error"}


def test_sync_progress_percent():
    restaurant = Restaurant(
        sync_status="running",
        sync_plan_from=date(2026, 1, 1),
        sync_plan_to=date(2026, 1, 10),
        sync_days_done=5,
    )
    assert sync_plan_day_count(date(2026, 1, 1), date(2026, 1, 10)) == 10
    assert sync_progress_percent(restaurant) == 50
