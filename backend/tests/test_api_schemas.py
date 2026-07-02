"""Strict schema validation for API page payloads."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app import PAGES, app
from backend.schemas.registry import SCHEMA_REGISTRY, validate_page

client = TestClient(app)
ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data"


@pytest.mark.parametrize("page", sorted(PAGES))
def test_fixture_json_matches_strict_schema(page: str):
    raw = json.loads((DATA / f"{page}.json").read_text(encoding="utf-8"))
    model = validate_page(page, raw)
    assert model.__class__ is SCHEMA_REGISTRY[page]


@pytest.mark.parametrize("page", sorted(PAGES))
def test_api_response_matches_strict_schema(page: str):
    response = client.get(f"/api/{page}")
    assert response.status_code == 200
    validate_page(page, response.json())


def test_schema_rejects_unknown_fields():
    raw = json.loads((DATA / "sales.json").read_text(encoding="utf-8"))
    raw["unexpectedField"] = True
    with pytest.raises(Exception):
        validate_page("sales", raw)
