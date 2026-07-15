from typing import Literal

from src.schemas.base import StrictModel
from src.schemas.stubs.common import CategoryKey

WriteoffMode = Literal["pct", "rub"]


class TargetsPeriod(StrictModel):
    year: int
    month: int
    label: str


class TargetsReference(StrictModel):
    label: str
    revenueFact: float
    revenuePace: float


class TargetsRevenue(StrictModel):
    monthPlan: float
    weekProfile: list[float]


class TargetsFoodcostUnit(StrictModel):
    key: CategoryKey
    name: str
    goalPct: float
    factPct: float


class TargetsWriteoffUnit(StrictModel):
    key: CategoryKey
    name: str
    mode: WriteoffMode
    pct: float
    rub: float


class TargetsCompliments(StrictModel):
    goalPct: float
    factPct: float
    factRub: float


class TargetsInventory(StrictModel):
    goalPct: float
    note: str


class TargetsData(StrictModel):
    period: TargetsPeriod
    reference: TargetsReference
    revenue: TargetsRevenue
    foodcost: list[TargetsFoodcostUnit]
    writeoffs: list[TargetsWriteoffUnit]
    compliments: TargetsCompliments
    inventory: TargetsInventory
