from typing import Type

from pydantic import BaseModel

from src.dashboard.schemas import DashboardV2

from .foodcost import FoodcostData
from .sales import SalesData
from .warehouse import WarehouseData

SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    # дашборд живёт на контракте v2 (src/dashboard/schemas.py) —
    # одна схема на роутер и на этот реестр, двух правд нет
    "dashboard": DashboardV2,
    "sales": SalesData,
    "warehouse": WarehouseData,
    "foodcost": FoodcostData,
}


def validate_page(page: str, payload: dict) -> BaseModel:
    schema = SCHEMA_REGISTRY[page]
    return schema.model_validate(payload)
