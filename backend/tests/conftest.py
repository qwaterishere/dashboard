"""Shared pytest fixtures for backend tests."""

import pytest
from fastapi.testclient import TestClient

from src.db.session import db_manager
from src.main import app


@pytest.fixture(scope="session")
def client():
    """TestClient с lifespan + гарантированная схема БД."""
    db_manager.create_all()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def disable_rate_limit_for_tests():
    app.state.limiter.enabled = False
    yield
    app.state.limiter.enabled = True
