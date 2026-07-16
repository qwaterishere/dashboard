"""Auth endpoints and JWT security."""

import pytest

from src.core.config import get_settings
from tests.conftest import DEV_ORIGIN, register_payload


def _auth_headers() -> dict[str, str]:
    return {"Origin": DEV_ORIGIN}


@pytest.mark.no_auth
def test_register_login_and_me(client):
    creds = register_payload(email="auth-flow@example.com")
    register = client.post("/api/auth/register", json=creds, headers=_auth_headers())
    assert register.status_code == 201
    body = register.json()
    assert "access_token" not in body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert register.cookies.get("access_token")
    assert register.cookies.get("refresh_token")

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    profile = me.json()
    assert profile["email"] == creds["email"]
    assert profile["first_name"] == creds["first_name"]
    assert profile["position"] == creds["position"]

    login = client.post(
        "/api/auth/login",
        json={"email": creds["email"], "password": creds["password"]},
        headers=_auth_headers(),
    )
    assert login.status_code == 200
    assert login.cookies.get("access_token")


@pytest.mark.no_auth
def test_login_rejects_invalid_password(client):
    client.post(
        "/api/auth/register",
        json=register_payload(email="bad-login@example.com"),
        headers=_auth_headers(),
    )
    response = client.post(
        "/api/auth/login",
        json={"email": "bad-login@example.com", "password": "WrongPass99"},
        headers=_auth_headers(),
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.no_auth
def test_register_rejects_duplicate_email_without_enumeration(client):
    creds = register_payload(email="dup@example.com")
    assert client.post("/api/auth/register", json=creds, headers=_auth_headers()).status_code == 201
    duplicate = client.post(
        "/api/auth/register",
        json=register_payload(email="dup@example.com"),
        headers=_auth_headers(),
    )
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "Registration failed"


@pytest.mark.no_auth
def test_refresh_rotates_token(client):
    creds = register_payload(email="refresh@example.com")
    register = client.post("/api/auth/register", json=creds, headers=_auth_headers())
    assert register.status_code == 201
    old_cookie = register.cookies.get("refresh_token")
    assert old_cookie

    refresh = client.post("/api/auth/refresh", headers=_auth_headers())
    assert refresh.status_code == 200
    new_cookie = refresh.cookies.get("refresh_token")
    assert new_cookie
    assert new_cookie != old_cookie

    reuse = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": old_cookie},
        headers=_auth_headers(),
    )
    assert reuse.status_code == 401


@pytest.mark.no_auth
def test_refresh_ignores_json_body(client):
    creds = register_payload(email="cookie-only@example.com")
    register = client.post("/api/auth/register", json=creds, headers=_auth_headers())
    assert register.status_code == 201
    cookie = register.cookies.get("refresh_token")
    assert cookie

    response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "0" * 48},
        cookies={"refresh_token": cookie},
        headers=_auth_headers(),
    )
    assert response.status_code == 200
    assert response.json()["expires_in"] > 0


@pytest.mark.no_auth
def test_logout_revokes_refresh_and_access(client):
    creds = register_payload(email="logout@example.com")
    register = client.post("/api/auth/register", json=creds, headers=_auth_headers())
    access_cookie = register.cookies.get("access_token")
    refresh_cookie = register.cookies.get("refresh_token")

    logout = client.post(
        "/api/auth/logout",
        cookies={"refresh_token": refresh_cookie},
        headers=_auth_headers(),
    )
    assert logout.status_code == 204
    set_cookie = logout.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "access_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()

    me = client.get("/api/auth/me", cookies={"access_token": access_cookie})
    assert me.status_code == 401

    refresh = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": refresh_cookie},
        headers=_auth_headers(),
    )
    assert refresh.status_code == 401


@pytest.mark.no_auth
def test_bearer_token_still_supported_for_api_clients(client):
    creds = register_payload(email="bearer@example.com")
    register = client.post("/api/auth/register", json=creds, headers=_auth_headers())
    assert register.status_code == 201

    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {register.cookies.get('access_token')}"},
    )
    assert me.status_code == 200


@pytest.mark.no_auth
def test_refresh_without_cookie_clears_cookie(client):
    response = client.post("/api/auth/refresh", headers=_auth_headers())
    assert response.status_code == 401
    set_cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "access_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()


@pytest.mark.no_auth
def test_refresh_invalid_token_clears_cookie(client):
    response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": "0" * 48},
        headers=_auth_headers(),
    )
    assert response.status_code == 401
    set_cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "access_token=" in set_cookie


@pytest.mark.no_auth
def test_csrf_rejects_untrusted_origin_in_production(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DB_URL", "postgresql+psycopg://user:pass@localhost/db")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("JWT_COOKIE_SECURE", "true")
    get_settings.cache_clear()

    response = client.post(
        "/api/auth/login",
        json={"email": "x@example.com", "password": "Secret123!"},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403
    get_settings.cache_clear()


@pytest.mark.no_auth
def test_protected_api_requires_auth(client):
    response = client.get("/api/dashboard")
    assert response.status_code == 401
