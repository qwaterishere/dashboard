"""Security tests for FastAPI backend."""

import pytest

from src.core.config import get_settings
from src.core.paths import RESOURCE_PROBES
from src.main import app

PROBE = "/api/base-metrics/bounds"


@pytest.mark.parametrize("probe", sorted(RESOURCE_PROBES))
def test_api_resource_probes_reachable(client, probe: str):
    """Канонические GET-ресурсы отвечают (200) или честный 404 без данных."""
    response = client.get(f"/api/{probe}")
    assert response.status_code in (200, 404)
    if response.status_code == 200:
        assert response.headers["content-type"].startswith("application/json")


def test_api_unknown_page_returns_404(client):
    response = client.get("/api/evil")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert isinstance(detail, dict)
    assert detail["message"] in ("Not found", "Not Found")
    assert detail["code"] == "http_error"


def test_api_path_traversal_blocked(client):
    response = client.get("/api/../../../etc/passwd")
    assert response.status_code in (404, 422)


def test_cors_not_wildcard_on_api_response(client):
    response = client.get(
        PROBE,
        headers={"Origin": "https://evil.example"},
    )
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin != "*"
    assert allow_origin != "https://evil.example"


def test_cors_exposes_request_id(client):
    response = client.get(
        "/api/health",
        headers={"Origin": "http://localhost:4200"},
    )
    expose = response.headers.get("access-control-expose-headers", "")
    assert "x-request-id" in expose.lower()


def test_security_headers_present(client):
    response = client.get(PROBE)
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "Content-Security-Policy" in response.headers
    assert "Strict-Transport-Security" not in response.headers


def test_hsts_header_when_enabled(client, monkeypatch):
    monkeypatch.setenv("HSTS_ENABLED", "true")
    get_settings.cache_clear()
    response = client.get(PROBE)
    hsts = response.headers.get("Strict-Transport-Security")
    assert hsts is not None
    assert "max-age=" in hsts
    assert "includeSubDomains" in hsts
    get_settings.cache_clear()


def test_rate_limit_blocks_excessive_requests(client):
    app.state.limiter.enabled = True
    try:
        for _ in range(70):
            client.get(PROBE)
        response = client.get(PROBE)
        assert response.status_code == 429
    finally:
        app.state.limiter.enabled = False
