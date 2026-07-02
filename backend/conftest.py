"""Pytest configuration for backend tests."""

import pytest

from backend.app import app


@pytest.fixture(autouse=True)
def disable_rate_limit_for_tests():
    """Most tests should not hit rate limits."""
    app.state.limiter.enabled = False
    yield
    app.state.limiter.enabled = True
