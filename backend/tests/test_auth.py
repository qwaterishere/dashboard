"""Auth endpoints and JWT security."""

import pytest

from tests.conftest import TEST_USER


@pytest.mark.no_auth
def test_register_login_and_me(client):
    creds = {
        **TEST_USER,
        "email": "auth-flow@example.com",
    }
    register = client.post("/api/auth/register", json=creds)
    assert register.status_code == 201
    body = register.json()
    assert "access_token" in body
    assert "refresh_token" not in body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert "refresh_token" in register.cookies

    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    profile = me.json()
    assert profile["email"] == creds["email"]
    assert profile["first_name"] == creds["first_name"]
    assert profile["position"] == creds["position"]

    login = client.post(
        "/api/auth/login",
        json={"email": creds["email"], "password": creds["password"]},
    )
    assert login.status_code == 200
    assert login.json()["access_token"]


@pytest.mark.no_auth
def test_login_rejects_invalid_password(client):
    client.post("/api/auth/register", json={**TEST_USER, "email": "bad-login@example.com"})
    response = client.post(
        "/api/auth/login",
        json={"email": "bad-login@example.com", "password": "WrongPass99"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


@pytest.mark.no_auth
def test_register_rejects_duplicate_email(client):
    creds = {**TEST_USER, "email": "dup@example.com"}
    assert client.post("/api/auth/register", json=creds).status_code == 201
    assert client.post("/api/auth/register", json=creds).status_code == 409


@pytest.mark.no_auth
def test_refresh_rotates_token(client):
    creds = {**TEST_USER, "email": "refresh@example.com"}
    register = client.post("/api/auth/register", json=creds)
    assert register.status_code == 201
    old_cookie = register.cookies.get("refresh_token")
    assert old_cookie

    refresh = client.post("/api/auth/refresh")
    assert refresh.status_code == 200
    new_cookie = refresh.cookies.get("refresh_token")
    assert new_cookie
    assert new_cookie != old_cookie

    reuse = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": old_cookie},
    )
    assert reuse.status_code == 401


@pytest.mark.no_auth
def test_refresh_ignores_json_body(client):
    creds = {**TEST_USER, "email": "cookie-only@example.com"}
    register = client.post("/api/auth/register", json=creds)
    assert register.status_code == 201
    cookie = register.cookies.get("refresh_token")
    assert cookie

    response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": "0" * 48},
        cookies={"refresh_token": cookie},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.no_auth
def test_logout_revokes_refresh_and_access(client):
    creds = {**TEST_USER, "email": "logout@example.com"}
    register = client.post("/api/auth/register", json=creds)
    access_token = register.json()["access_token"]
    refresh_cookie = register.cookies.get("refresh_token")

    logout = client.post("/api/auth/logout", cookies={"refresh_token": refresh_cookie})
    assert logout.status_code == 204
    set_cookie = logout.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()

    me = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me.status_code == 401

    refresh = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": refresh_cookie},
    )
    assert refresh.status_code == 401


@pytest.mark.no_auth
def test_refresh_without_cookie_clears_cookie(client):
    response = client.post("/api/auth/refresh")
    assert response.status_code == 401
    set_cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()


@pytest.mark.no_auth
def test_refresh_invalid_token_clears_cookie(client):
    response = client.post(
        "/api/auth/refresh",
        cookies={"refresh_token": "0" * 48},
    )
    assert response.status_code == 401
    set_cookie = response.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()


@pytest.mark.no_auth
def test_protected_api_requires_auth(client):
    response = client.get("/api/dashboard")
    assert response.status_code == 401
