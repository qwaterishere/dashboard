"""Реестр Pydantic-схем страниц API — для тестов контракта."""

from pydantic import BaseModel

from src.schemas.dashboard import Dashboard
from src.schemas.sales import SalesPage
from src.schemas.targets import TargetsData
from src.schemas.warehouse import Warehouse

SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "dashboard": Dashboard,
    "sales": SalesPage,
    "warehouse": Warehouse,
    "targets": TargetsData,
}


def validate_page(page: str, payload: dict) -> BaseModel:
    schema = SCHEMA_REGISTRY[page]
    return schema.model_validate(payload)
