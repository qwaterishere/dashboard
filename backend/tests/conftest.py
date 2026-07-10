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

TEST_USER = {
    "email": "test@example.com",
    "password": "TestPass123!",
    "first_name": "Тест",
    "last_name": "Пользователь",
    "position": "Управляющий",
}

DEV_ORIGIN = "http://localhost:4200"


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
        json=TEST_USER,
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
