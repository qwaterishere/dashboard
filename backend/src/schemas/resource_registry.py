"""Реестр Pydantic-схем для контрактных тестов resource REST."""

from pydantic import BaseModel

from src.schemas.base_metrics import MetricSnapshot
from src.schemas.foodcost import Foodcost
from src.schemas.sales import SalesPage
from src.schemas.stock import StockSnapshot
from src.schemas.targets import TargetsData

# Ключи — логические ресурсы; HTTP-пути — /api/{resource}/… 
SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "sales": SalesPage,
    "stock": StockSnapshot,
    "foodcost": Foodcost,
    "targets": TargetsData,
    "base-metrics": MetricSnapshot,
}


def validate_resource(resource: str, payload: dict) -> BaseModel:
    schema = SCHEMA_REGISTRY[resource]
    return schema.model_validate(payload)
