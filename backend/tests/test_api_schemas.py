"""Strict schema validation for API page payloads."""

import json
from pathlib import Path

import pytest

from src.main import PAGES
from src.schemas.foodcost import Foodcost
from src.schemas.warehouse import Warehouse
from src.schemas.stubs.registry import SCHEMA_REGISTRY, validate_page

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


# dashboard и foodcost — живые API; JSON-мокапы удалены
@pytest.mark.parametrize("page", sorted(PAGES - {"dashboard", "foodcost"}))
def test_fixture_json_matches_strict_schema(page: str):
    raw = json.loads((DATA / f"{page}.json").read_text(encoding="utf-8"))
    model = validate_page(page, raw)
    assert model.__class__ is SCHEMA_REGISTRY[page]


# foodcost и warehouse — на v2-контрактах (свои тесты ниже); targets — стаб
@pytest.mark.parametrize("page", sorted(PAGES - {"foodcost", "warehouse"}))
def test_api_response_matches_strict_schema(client, page: str):
    response = client.get(f"/api/{page}")
    assert response.status_code == 200
    validate_page(page, response.json())


def test_api_foodcost_matches_contract(client):
    response = client.get("/api/foodcost")
    assert response.status_code == 200
    Foodcost.model_validate(response.json())


def test_api_warehouse_matches_v2_contract(client):
    response = client.get("/api/warehouse")
    assert response.status_code == 200
    Warehouse.model_validate(response.json())


def test_schema_rejects_unknown_fields():
    raw = json.loads((DATA / "warehouse.json").read_text(encoding="utf-8"))
    raw["unexpectedField"] = True
    with pytest.raises(Exception):
        validate_page("warehouse", raw)
