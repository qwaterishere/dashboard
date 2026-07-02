from pydantic import Field

from .common import CategoryKey, LflDirection, LflMetric, PeriodInfo, StrictModel


class ForecastBlock(StrictModel):
    value: float
    planPct: float
    trackPct: float
    risk: bool


class RevenueKpi(StrictModel):
    value: float
    lfl: LflMetric
    checks: int
    guests: int
    forecast: ForecastBlock


class AvgCheckKpi(StrictModel):
    value: float
    lfl: LflMetric
    perGuest: float
    qualityFlag: bool
    forecast: ForecastBlock


class GuestsKpi(StrictModel):
    value: float
    lfl: LflMetric
    perCheck: float
    checks: int
    forecast: ForecastBlock


class Kpis(StrictModel):
    revenue: RevenueKpi
    avgCheck: AvgCheckKpi
    guests: GuestsKpi


class RevenueDay(StrictModel):
    day: int
    weekday: int
    revenue: float
    plan: float
    checks: int
    guests: int
    avg: float


class ReviewSplit(StrictModel):
    good: int
    mid: int
    bad: int
    goodPct: int
    midPct: int
    badPct: int


class ReviewSource(StrictModel):
    name: str
    score: float
    count: int


class ReviewsBlock(StrictModel):
    score: float
    count: int
    split: ReviewSplit
    sources: list[ReviewSource]


class FoodcostMiniItem(StrictModel):
    key: CategoryKey
    name: str
    pct: float
    goal: float
    deltaPP: float
    dir: LflDirection


class FoodcostMiniBlock(StrictModel):
    caption: str
    items: list[FoodcostMiniItem]


class CategoryPct(StrictModel):
    key: CategoryKey
    name: str
    pct: float


class StockItem(StrictModel):
    key: CategoryKey
    name: str
    value: float


class StockBlock(StrictModel):
    total: float
    items: list[StockItem]


class DetailPopover(StrictModel):
    title: str
    rows: list[list[str]]
    footnote: str


class DashboardData(StrictModel):
    greeting: str
    period: PeriodInfo
    kpis: Kpis
    revenueByDay: list[RevenueDay]
    revenueByDayMax: float
    reviews: ReviewsBlock
    foodcostMini: FoodcostMiniBlock
    categories: list[CategoryPct]
    stock: StockBlock
    details: dict[str, DetailPopover] = Field(default_factory=dict)
