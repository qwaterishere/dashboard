from pydantic import BaseModel

from src.schemas.dashboard import Dashboard
from src.schemas.sales import SalesPage
from src.schemas.stubs.targets import TargetsData
from src.schemas.stubs.warehouse import WarehouseData

SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "dashboard": Dashboard,
    "sales": SalesPage,
    "warehouse": WarehouseData,
    "targets": TargetsData,
}


def validate_page(page: str, payload: dict) -> BaseModel:
    schema = SCHEMA_REGISTRY[page]
    return schema.model_validate(payload)
