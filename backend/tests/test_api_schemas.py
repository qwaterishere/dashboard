"""Strict schema validation for API page payloads."""

import json
from pathlib import Path

import pytest

from src.main import PAGES
from src.schemas.stubs.registry import SCHEMA_REGISTRY, validate_page

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


# dashboard живёт на реальных данных (контракт v2), его JSON-мокап удалён —
# фикстурная проверка осталась только для страниц-заглушек
@pytest.mark.parametrize("page", sorted(PAGES - {"dashboard"}))
def test_fixture_json_matches_strict_schema(page: str):
    raw = json.loads((DATA / f"{page}.json").read_text(encoding="utf-8"))
    model = validate_page(page, raw)
    assert model.__class__ is SCHEMA_REGISTRY[page]


@pytest.mark.parametrize("page", sorted(PAGES))
def test_api_response_matches_strict_schema(client, page: str):
    response = client.get(f"/api/{page}")
    assert response.status_code == 200
    validate_page(page, response.json())


def test_schema_rejects_unknown_fields():
    raw = json.loads((DATA / "foodcost.json").read_text(encoding="utf-8"))
    raw["unexpectedField"] = True
    with pytest.raises(Exception):
        validate_page("foodcost", raw)
