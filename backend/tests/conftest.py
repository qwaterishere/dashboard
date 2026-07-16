"""Shared pytest fixtures for backend tests."""

import os

os.environ["DB_URL"] = "sqlite:///:memory:"
os.environ.setdefault("APP_ENV", "development")

from src.core.config import get_settings

get_settings.cache_clear()

import pytest
from fastapi.testclient import TestClient

from src.db.session import db_manager
from src.main import app
from src.services.invites import create_invite

TEST_USER = {
    "email": "test@example.com",
    "password": "TestPass123!",
    "first_name": "Тест",
    "last_name": "Пользователь",
    "position": "Управляющий",
}

DEV_ORIGIN = "http://localhost:4200"


def issue_invite_key(*, ttl_days: int = 14, note: str | None = None) -> str:
    """Одноразовый ключ для тестов регистрации."""
    session = db_manager.get_session()
    try:
        raw, _invite = create_invite(session, ttl_days=ttl_days, note=note)
        session.commit()
        return raw
    finally:
        session.close()


def register_payload(**overrides) -> dict:
    """Тело POST /api/auth/register с свежим invite_key."""
    data = {**TEST_USER, **overrides}
    if "invite_key" not in overrides:
        data["invite_key"] = issue_invite_key()
    return data


@pytest.fixture(scope="session")
def client():
    """TestClient с lifespan + гарантированная схема БД."""
    db_manager.create_all()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def auth_cookies(client):
    """HttpOnly session cookies для защищённых эндпоинтов в тестах."""
    response = client.post(
        "/api/auth/register",
        json=register_payload(),
        headers={"Origin": DEV_ORIGIN},
    )
    if response.status_code == 400:
        response = client.post(
            "/api/auth/login",
            json={"email": TEST_USER["email"], "password": TEST_USER["password"]},
            headers={"Origin": DEV_ORIGIN},
        )
    assert response.status_code in (200, 201), response.text
    assert client.cookies.get("access_token")
    return dict(client.cookies)


@pytest.fixture(autouse=True)
def authenticate_api_requests(request, client, auth_cookies):
    """Все тесты, кроме no_auth, ходят в API с session cookies."""
    if "no_auth" in request.keywords:
        client.cookies.clear()
        yield
        return
    client.cookies.update(auth_cookies)
    yield


@pytest.fixture(autouse=True)
def disable_rate_limit_for_tests():
    app.state.limiter.enabled = False
    yield
    app.state.limiter.enabled = True
