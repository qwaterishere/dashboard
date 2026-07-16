"""Profile update and password change."""

import pytest

from tests.conftest import DEV_ORIGIN, register_payload


def _headers() -> dict[str, str]:
    return {"Origin": DEV_ORIGIN}


@pytest.mark.no_auth
def test_update_profile(client):
    creds = register_payload(email="profile@example.com")
    client.post("/api/auth/register", json=creds, headers=_headers())

    response = client.patch(
        "/api/auth/me",
        json={
            "first_name": "Новое",
            "last_name": "Имя",
            "position": "Бухгалтер",
        },
        headers=_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["first_name"] == "Новое"
    assert body["last_name"] == "Имя"
    assert body["position"] == "Бухгалтер"
    assert body["email"] == creds["email"]

    me = client.get("/api/auth/me")
    assert me.json()["position"] == "Бухгалтер"


@pytest.mark.no_auth
def test_change_password_rotates_session(client):
    creds = register_payload(email="pwd@example.com")
    register = client.post("/api/auth/register", json=creds, headers=_headers())
    old_access = register.cookies.get("access_token")
    old_refresh = register.cookies.get("refresh_token")

    response = client.post(
        "/api/auth/change-password",
        json={
            "current_password": creds["password"],
            "new_password": "NewPass123!",
        },
        headers=_headers(),
    )
    assert response.status_code == 200
    assert response.cookies.get("access_token") != old_access
    assert response.cookies.get("refresh_token") != old_refresh

    login = client.post(
        "/api/auth/login",
        json={"email": creds["email"], "password": "NewPass123!"},
        headers=_headers(),
    )
    assert login.status_code == 200

    bad_old = client.post(
        "/api/auth/login",
        json={"email": creds["email"], "password": creds["password"]},
        headers=_headers(),
    )
    assert bad_old.status_code == 401


@pytest.mark.no_auth
def test_change_password_rejects_wrong_current(client):
    creds = register_payload(email="pwd-bad@example.com")
    client.post("/api/auth/register", json=creds, headers=_headers())

    response = client.post(
        "/api/auth/change-password",
        json={
            "current_password": "WrongPass99",
            "new_password": "NewPass123!",
        },
        headers=_headers(),
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid current password"


@pytest.mark.no_auth
def test_change_password_rejects_same_password(client):
    creds = register_payload(email="pwd-same@example.com")
    client.post("/api/auth/register", json=creds, headers=_headers())

    response = client.post(
        "/api/auth/change-password",
        json={
            "current_password": creds["password"],
            "new_password": creds["password"],
        },
        headers=_headers(),
    )
    assert response.status_code == 422
