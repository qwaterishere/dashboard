from .common import CategoryKey, PeriodInfo, StrictModel


class SalesPosition(StrictModel):
    name: str
    sub: str
    cat: CategoryKey
    qty: float  # порций; дробное у весовых блюд (например, 4.5 кг)
    price: float
    unitCost: float


class SalesData(StrictModel):
    period: PeriodInfo
    positions: list[SalesPosition]
