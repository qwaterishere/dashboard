from typing import Type

from pydantic import BaseModel

from .dashboard import DashboardData
from .foodcost import FoodcostData
from .sales import SalesData
from .warehouse import WarehouseData

SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "dashboard": DashboardData,
    "sales": SalesData,
    "warehouse": WarehouseData,
    "foodcost": FoodcostData,
}


def validate_page(page: str, payload: dict) -> BaseModel:
    schema = SCHEMA_REGISTRY[page]
    return schema.model_validate(payload)
