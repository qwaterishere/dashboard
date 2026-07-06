"""Security tests for FastAPI backend."""

import pytest
from fastapi.testclient import TestClient

from backend.app import PAGES, app

client = TestClient(app)


@pytest.mark.parametrize("page", sorted(PAGES))
def test_api_known_pages_return_200(page: str):
    response = client.get(f"/api/{page}")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")


def test_api_unknown_page_returns_404():
    response = client.get("/api/evil")
    assert response.status_code == 404
    assert response.json()["detail"] == "Not found"


def test_api_path_traversal_blocked():
    response = client.get("/api/../../../etc/passwd")
    assert response.status_code in (404, 422)


def test_cors_not_wildcard_on_api_response():
    response = client.get(
        "/api/dashboard",
        headers={"Origin": "https://evil.example"},
    )
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin != "*"
    assert allow_origin != "https://evil.example"


def test_cors_allows_local_dev_origin():
    response = client.get(
        "/api/dashboard",
        headers={"Origin": "http://localhost:4200"},
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:4200"


def test_security_headers_present():
    response = client.get("/api/dashboard")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in response.headers


def test_rate_limit_blocks_excessive_requests():
    # /api/dashboard обслуживается доменным роутером (без лимитера) —
    # лимитер висит на catch-all страницах-заглушках, проверяем на них
    app.state.limiter.enabled = True
    try:
        for _ in range(70):
            client.get("/api/foodcost")
        response = client.get("/api/foodcost")
        assert response.status_code == 429
    finally:
        app.state.limiter.enabled = False
