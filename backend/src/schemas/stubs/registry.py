from pydantic import BaseModel

from src.schemas.dashboard import DashboardV2
from src.schemas.sales import SalesPage
from src.schemas.stubs.foodcost import FoodcostData
from src.schemas.stubs.warehouse import WarehouseData

SCHEMA_REGISTRY: dict[str, type[BaseModel]] = {
    "dashboard": DashboardV2,
    "sales": SalesPage,
    "warehouse": WarehouseData,
    "foodcost": FoodcostData,
}


def validate_page(page: str, payload: dict) -> BaseModel:
    schema = SCHEMA_REGISTRY[page]
    return schema.model_validate(payload)
