from .common import CategoryKey, StrictModel


class WarehouseAsOf(StrictModel):
    label: str
    note: str


class WarehouseStoreTotal(StrictModel):
    key: CategoryKey
    name: str
    value: float


class WarehouseTotals(StrictModel):
    value: float
    stores: int
    byStore: list[WarehouseStoreTotal]


class WarehousePosition(StrictModel):
    name: str
    sub: str
    store: CategoryKey
    qty: int
    unit: str
    price: float


class DynamicsSeries(StrictModel):
    labels: list[str]
    values: list[float]


class WarehouseDynamics(StrictModel):
    week: DynamicsSeries
    month: DynamicsSeries


class WarehouseData(StrictModel):
    asOf: WarehouseAsOf
    totals: WarehouseTotals
    positions: list[WarehousePosition]
    dynamics: dict[str, WarehouseDynamics]
