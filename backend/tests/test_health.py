def test_health_returns_ok(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_ready_returns_ready(client):
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_request_id_echoed(client):
    response = client.get("/health", headers={"X-Request-Id": "test-req-1"})
    assert response.status_code == 200
    assert response.headers.get("X-Request-Id") == "test-req-1"


def test_api_ready_failure_does_not_leak_exception(client, monkeypatch):
    from src.db.session import db_manager

    class _BoomEngine:
        def connect(self):
            raise RuntimeError(
                "sqlalchemy.exc.OperationalError: "
                "(psycopg.OperationalError) connection to server at "
                '"db.internal" failed: FATAL: password authentication failed '
                "for user \"dashboard\" "
                "postgresql+psycopg://dashboard:s3cret@db.internal:5432/app"
            )

    monkeypatch.setattr(db_manager, "engine", _BoomEngine())
    response = client.get("/api/ready")
    assert response.status_code == 503
    body = response.json()
    assert body == {"status": "not_ready", "detail": "database unavailable"}
    leaked = response.text.lower()
    assert "sqlalchemy" not in leaked
    assert "password" not in leaked
    assert "postgresql" not in leaked
    assert "s3cret" not in leaked
    assert "db.internal" not in leaked
