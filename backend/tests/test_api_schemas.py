"""Strict schema validation for API page payloads."""

import json
from pathlib import Path

import pytest

from src.main import PAGES
from src.schemas.foodcost import Foodcost
from src.schemas.page_registry import SCHEMA_REGISTRY, validate_page
from src.schemas.warehouse import Warehouse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Живые API без JSON-фикстур в data/
LIVE_PAGES = frozenset({"dashboard", "foodcost", "warehouse", "targets"})


@pytest.mark.parametrize("page", sorted(PAGES - LIVE_PAGES))
def test_fixture_json_matches_strict_schema(page: str):
    raw = json.loads((DATA / f"{page}.json").read_text(encoding="utf-8"))
    model = validate_page(page, raw)
    assert model.__class__ is SCHEMA_REGISTRY[page]


@pytest.mark.parametrize("page", sorted(PAGES - LIVE_PAGES))
def test_api_response_matches_strict_schema(client, page: str):
    response = client.get(f"/api/{page}")
    assert response.status_code == 200
    validate_page(page, response.json())


def test_api_foodcost_matches_contract(client):
    response = client.get("/api/foodcost")
    assert response.status_code == 200
    Foodcost.model_validate(response.json())


def test_api_warehouse_empty_or_contract(client):
    """Без слепков — 404; с данными — строгий Warehouse."""
    response = client.get("/api/warehouse")
    if response.status_code == 404:
        return
    assert response.status_code == 200
    Warehouse.model_validate(response.json())


def test_schema_rejects_unknown_fields():
    raw = {
        "asOf": "2026-07-14",
        "dataBounds": {
            "earliest": "2026-07-14",
            "latest": "2026-07-14",
            "availableDates": ["2026-07-14"],
        },
        "totals": [
            {"key": "k", "value": 1},
            {"key": "b", "value": 0},
            {"key": "w", "value": 0},
        ],
        "positions": [],
        "negativeStock": {"count": 0, "valueAbs": 0},
        "dynamics": [],
        "unexpectedField": True,
    }
    with pytest.raises(Exception):
        Warehouse.model_validate(raw)
