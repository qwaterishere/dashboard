from src.schemas.stubs.common import CategoryKey, DiscountTone, LflMetric, PeriodInfo, StrictModel


class FoodcostOverviewCard(StrictModel):
    title: str
    tag: str
    subtitle: str
    pct: float
    lfl: LflMetric
    goal: float
    cost: float
    revenue: float | None = None
    overSales: float | None = None


class FoodcostOverview(StrictModel):
    clean: FoodcostOverviewCard
    dirty: FoodcostOverviewCard


class FoodcostUnit(StrictModel):
    key: CategoryKey
    name: str
    pct: float
    lfl: LflMetric
    goal: float
    cost: float
    shareOfSpend: float


class FoodcostLossRow(StrictModel):
    name: str
    note: str
    fact: float
    goal: float


class FoodcostLossTotal(StrictModel):
    fact: float
    goal: float


class FoodcostLosses(StrictModel):
    rows: list[FoodcostLossRow]
    total: FoodcostLossTotal


class FoodcostDiscount(StrictModel):
    label: str
    value: str
    caption: str
    tone: DiscountTone | None = None


class FoodcostCategoryRow(StrictModel):
    name: str
    fact: float
    goal: float
    cost: float


class FoodcostProduct(StrictModel):
    name: str
    group: CategoryKey
    price: float
    cost: float


class FoodcostData(StrictModel):
    period: PeriodInfo
    overview: FoodcostOverview
    units: list[FoodcostUnit]
    losses: FoodcostLosses
    discounts: list[FoodcostDiscount]
    categories: dict[CategoryKey, list[FoodcostCategoryRow]]
    products: list[FoodcostProduct]
