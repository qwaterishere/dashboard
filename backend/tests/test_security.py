"""Security tests for FastAPI backend."""

import pytest
from fastapi.testclient import TestClient

from backend.app import app, PAGES

client = TestClient(app)


@pytest.mark.parametrize("page", sorted(PAGES))
def test_api_known_pages_return_200(page: str):
    response = client.get(f"/api/{page}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")


def test_api_unknown_page_returns_404():
    response = client.get("/api/evil")
    assert response.status_code == 404


def test_api_path_traversal_blocked():
    response = client.get("/api/../../../etc/passwd")
    assert response.status_code in (404, 422)


def test_cors_not_wildcard_on_api_response():
    response = client.get(
        "/api/dashboard",
        headers={"Origin": "https://evil.example"},
    )
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin != "*" or allow_origin is None
