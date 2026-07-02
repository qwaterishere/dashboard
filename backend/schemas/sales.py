from .common import CategoryKey, PeriodInfo, StrictModel


class SalesPosition(StrictModel):
    name: str
    sub: str
    cat: CategoryKey
    qty: int
    price: float
    unitCost: float


class SalesData(StrictModel):
    period: PeriodInfo
    positions: list[SalesPosition]
