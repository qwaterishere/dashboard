from typing import Literal

from .base import StrictModel
from .base import Period


class BaseCost(StrictModel):
    """Слагаемые фудкоста. База страницы — переиспользуется
          тоталами, юнитами и группами (наследованием)."""
    revenue: float  # вся выручка разреза (paid > 0, не staff)
    cost: float  # себестоимость всех продажных строк
    revenueWithCost: float  # выручка строк с cost > 0 — знаменатель фудкоста
    prevRevenue: float | None  # те же три числа за compare-период;
    prevCost: float | None  # null — сравнивать не с чем
    prevRevenueWithCost: float | None


class CostTotals(BaseCost):
    """Общие факты + цели"""
    goal: float | None  # ЦЕЛЬ: null до модуля targets


class UnitCost(BaseCost):
    key: Literal['k', 'b', 'w', 'o']


class GroupCost(BaseCost):
    unit: Literal['k', 'b', 'w', 'o']
    group: str  # группа iiko (живой разрез, как выяснили)


class Discounts(StrictModel):
    discountSum: float  # недополученная выручка (sum(discount))
    discountedRevenue: float  # общая выручка по скидочным позициям
    discountedRevenueWithCost: float  # выручка скидочных строк с cost > 0 — знаменатель их фудкоста
    discountSumWithCost: float  # скидки строк с cost > 0 — влияние скидок на ОБЩИЙ фудкост
    discountedCost: float  # себестоимость скидочных позиций


class Compliments(StrictModel):
    """Представительские/комплименты: paid = 0, price > 0."""
    cost: float                     # реальные затраты заведения
    priceValue: float               # упущенная выручка по прайсу
    qty: float                      # сумма порций (не всегда в шт.)


class Staff(StrictModel):
    """Питание персонала ЧЕРЕЗ КАССУ (is_staff)."""
    cost: float                     # реальные затраты заведения
    paidSum: float                  # внутренняя «выручка» по спеццене
    qty: float


class Losses(StrictModel):
    compliments: Compliments
    staff: Staff
    writeoffs: None = None          # акты списания — фаза 2 (домен writeoffs)


class Foodcost(StrictModel):
    period: Period
    compare: Period
    totals: CostTotals              # overview.clean в сырье
    dirty: None = None              # фаза 2: до полных потерь число врало бы
    units: list[UnitCost]           # всегда 4: k, b, w, o
    groups: list[GroupCost]
    discounts: Discounts
    losses: Losses