"""Strict schema validation for API resource payloads."""

import pytest

from src.schemas.resource_registry import SCHEMA_REGISTRY, validate_resource
from src.schemas.stock import StockSnapshot

RESOURCE_PATHS = {
    "sales": "/api/sales/snapshot",
    "stock": "/api/stock/snapshot",
    "foodcost": "/api/foodcost/snapshot",
    "targets": "/api/targets",
    "base-metrics": "/api/base-metrics/snapshot",
}


@pytest.mark.parametrize("resource", sorted(set(SCHEMA_REGISTRY) - {"stock", "base-metrics"}))
def test_api_response_matches_strict_schema(client, resource: str):
    """Живой API — единственный источник контракта (static JSON-фикстур нет)."""
    response = client.get(RESOURCE_PATHS[resource])
    assert response.status_code == 200
    model = validate_resource(resource, response.json())
    assert model.__class__ is SCHEMA_REGISTRY[resource]


def test_api_stock_empty_or_contract(client):
    """Без слепков — 404; с данными — строгий StockSnapshot."""
    response = client.get("/api/stock/snapshot")
    if response.status_code == 404:
        return
    assert response.status_code == 200
    StockSnapshot.model_validate(response.json())


def test_api_base_metrics_snapshot_contract(client):
    response = client.get(
        "/api/base-metrics/snapshot",
        params={"date_from": "2026-01-01", "date_to": "2026-01-07"},
    )
    # Пустая БД / нет продаж — 200 с нулями или 422 domain; не 500.
    assert response.status_code in (200, 422)
    if response.status_code == 200:
        validate_resource("base-metrics", response.json())


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
        StockSnapshot.model_validate(raw)
