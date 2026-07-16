"""Одноразовые invite-ключи регистрации."""

from datetime import UTC, datetime, timedelta

import pytest

from src.db.models.invite import InviteKey
from src.db.session import db_manager
from src.services.invites import create_invite, hash_invite_key
from tests.conftest import DEV_ORIGIN, issue_invite_key, register_payload


def _headers() -> dict[str, str]:
    return {"Origin": DEV_ORIGIN}


@pytest.mark.no_auth
def test_register_requires_invite_key(client):
    payload = register_payload(email="no-key@example.com")
    del payload["invite_key"]
    response = client.post("/api/auth/register", json=payload, headers=_headers())
    assert response.status_code == 422


@pytest.mark.no_auth
def test_register_rejects_invalid_invite_key(client):
    response = client.post(
        "/api/auth/register",
        json=register_payload(email="bad-key@example.com", invite_key="not-a-valid-invite-key"),
        headers=_headers(),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid invite key"


@pytest.mark.no_auth
def test_register_rejects_used_invite_key(client):
    key = issue_invite_key()
    first = register_payload(email="first-invite@example.com", invite_key=key)
    assert client.post("/api/auth/register", json=first, headers=_headers()).status_code == 201

    second = register_payload(email="second-invite@example.com", invite_key=key)
    reused = client.post("/api/auth/register", json=second, headers=_headers())
    assert reused.status_code == 400
    assert reused.json()["detail"] == "Invalid invite key"


@pytest.mark.no_auth
def test_register_rejects_expired_invite_key(client):
    session = db_manager.get_session()
    try:
        raw, invite = create_invite(session, ttl_days=1)
        invite.expires_at = datetime.now(UTC) - timedelta(hours=1)
        session.commit()
    finally:
        session.close()

    response = client.post(
        "/api/auth/register",
        json=register_payload(email="expired@example.com", invite_key=raw),
        headers=_headers(),
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid invite key"


@pytest.mark.no_auth
def test_register_with_valid_invite_marks_key_used(client):
    payload = register_payload(email="invite-ok@example.com")
    key = payload["invite_key"]
    response = client.post("/api/auth/register", json=payload, headers=_headers())
    assert response.status_code == 201

    session = db_manager.get_session()
    try:
        invite = session.query(InviteKey).filter_by(key_hash=hash_invite_key(key)).one()
        assert invite.used_at is not None
        assert invite.used_by_user_id is not None
    finally:
        session.close()
