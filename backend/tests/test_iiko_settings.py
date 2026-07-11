"""iiko settings API."""

import uuid

import pytest

from tests.conftest import DEV_ORIGIN, TEST_USER


def _auth_headers() -> dict[str, str]:
    return {"Origin": DEV_ORIGIN}


@pytest.mark.no_auth
def test_iiko_settings_initially_unconfigured(client):
    creds = {**TEST_USER, "email": "iiko-settings@example.com"}
    register = client.post("/api/auth/register", json=creds, headers=_auth_headers())
    assert register.status_code == 201

    response = client.get("/api/auth/me/iiko")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["iiko_url"] is None
    assert "restaurant_id" in body
    assert body["sync"]["status"] == "idle"


@pytest.mark.no_auth
def test_save_iiko_requires_password_on_first_setup(client, monkeypatch):
    creds = {**TEST_USER, "email": "iiko-save@example.com"}
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    monkeypatch.setattr("src.services.restaurant.IikoClient", FakeClient)

    missing_password = client.put(
        "/api/auth/me/iiko",
        json={
            "iiko_url": "https://demo.iiko.it:443",
            "iiko_login": "api",
            "iiko_password": "",
        },
        headers=_auth_headers(),
    )
    assert missing_password.status_code == 422

    saved = client.put(
        "/api/auth/me/iiko",
        json={
            "iiko_url": "https://demo.iiko.it:443",
            "iiko_login": "api",
            "iiko_password": "secret",
        },
        headers=_auth_headers(),
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["configured"] is True
    assert body["iiko_url"] == "https://demo.iiko.it:443"
    assert body["iiko_login"] == "api"

    fetched = client.get("/api/auth/me/iiko")
    assert fetched.json()["configured"] is True


@pytest.mark.no_auth
@pytest.mark.parametrize(
    "iiko_url",
    [
        "http://demo.iiko.it:443",
        "https://127.0.0.1",
        "https://10.0.0.5",
        "https://localhost",
        "https://evil.example.com",
    ],
)
def test_save_iiko_rejects_unsafe_url(client, iiko_url: str):
    creds = {**TEST_USER, "email": f"iiko-url-{uuid.uuid4()}@example.com"}
    client.post("/api/auth/register", json=creds, headers=_auth_headers())

    response = client.put(
        "/api/auth/me/iiko",
        json={
            "iiko_url": iiko_url,
            "iiko_login": "api",
            "iiko_password": "secret",
        },
        headers=_auth_headers(),
    )
    assert response.status_code == 422
