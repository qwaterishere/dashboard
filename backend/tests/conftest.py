"""Shared pytest fixtures for backend tests."""

import os

os.environ["DB_URL"] = "sqlite:///:memory:"

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


@pytest.fixture(scope="session")
def client():
    """TestClient с lifespan + гарантированная схема БД."""
    db_manager.create_all()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def access_token(client):
    """Access token для защищённых эндпоинтов в тестах."""
    response = client.post("/api/auth/register", json=TEST_USER)
    if response.status_code == 409:
        response = client.post(
            "/api/auth/login",
            json={"email": TEST_USER["email"], "password": TEST_USER["password"]},
        )
    assert response.status_code in (200, 201), response.text
    return response.json()["access_token"]


@pytest.fixture(autouse=True)
def authenticate_api_requests(request, client, access_token):
    """Все тесты, кроме no_auth, ходят в API с Bearer-токеном."""
    if "no_auth" in request.keywords:
        yield
        return
    client.headers["Authorization"] = f"Bearer {access_token}"
    yield
    client.headers.pop("Authorization", None)


@pytest.fixture(autouse=True)
def disable_rate_limit_for_tests():
    app.state.limiter.enabled = False
    yield
    app.state.limiter.enabled = True
