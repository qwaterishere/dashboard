"""Контракт страницы «Фудкост», фаза 1 — backend-todo №9."""

from typing import Literal

from pydantic import Field

from .base import StrictModel
from .base import Period


class BaseCost(StrictModel):
    """Факты фудкоста одного разреза. Производные — зона фронтенда:
    fc = cost / revenueWithCost; покрытие = revenueWithCost / revenue."""

    revenue: float = Field(description="Выручка разреза за period (строки paid > 0)")
    cost: float = Field(
        description="Себестоимость фудкост-строк (paid > 0 и cost > 0): "
        "строки без техкарт в фудкосте не участвуют"
    )
    revenueWithCost: float = Field(
        description="Выручка фудкост-строк — знаменатель фудкоста; "
        "revenueWithCost / revenue = покрытие техкартами"
    )
    prevRevenue: float | None = Field(
        description="Те же три числа за compare-период; "
        "null — сравнивать не с чем (в compare нет платных чеков)"
    )
    prevCost: float | None = Field(description="Себестоимость за compare")
    prevRevenueWithCost: float | None = Field(
        description="Выручка фудкост-строк за compare"
    )


class CostTotals(BaseCost):
    """Тоталы страницы: факты + цель."""

    goal: float | None = Field(
        description="Цель фудкоста, %; null — цели не внесены (до модуля targets)"
    )


class UnitCost(BaseCost):
    key: Literal['k', 'b', 'w', 'o'] = Field(
        description="Юнит: k кухня, b бар, w вино, o «вне подразделений» "
        "(группы iiko вне папок Кухня/Бар/Вино)"
    )
    goal: float | None = Field(
        default=None,
        description="Цель фудкоста юнита, %; null — цель не задана в Целях",
    )


class GroupCost(BaseCost):
    unit: Literal['k', 'b', 'w', 'o'] = Field(description="Юнит группы")
    group: str = Field(
        description="Группа iiko — папка, в которой лежит блюдо "
        "(живой разрез, терминология — frontend-handoff §0)"
    )
    goal: float | None = Field(
        default=None,
        description="Цель % (наследуется от юнита в Целях); null — нет цели",
    )


class Discounts(StrictModel):
    """Скидки — легитимный инструмент (не потери): что они делают с фудкостом.
    Фронт считает: фудкост скидочных = discountedCost / discountedRevenueWithCost;
    влияние на общий = fc − cost / (revenueWithCost + discountSumWithCost)."""

    discountSum: float = Field(
        description="Недополученная выручка: sum(discount) по строкам paid > 0"
    )
    discountedRevenue: float = Field(
        description="Выручка скидочных строк (paid > 0 и discount > 0)"
    )
    discountedRevenueWithCost: float = Field(
        description="Выручка скидочных строк с cost > 0 — знаменатель их фудкоста"
    )
    discountSumWithCost: float = Field(
        description="Скидки строк с cost > 0 — для влияния скидок на ОБЩИЙ фудкост"
    )
    discountedCost: float = Field(
        description="Себестоимость скидочных строк с cost > 0"
    )


class Compliments(StrictModel):
    """Комплименты/представительские через кассу: paid = 0, price > 0."""

    cost: float = Field(description="Реальные затраты заведения (по техкартам)")
    priceValue: float = Field(description="Упущенная выручка по прайсу")
    qty: float = Field(description="Порций; дробное у весовых блюд")


class Staff(StrictModel):
    """Питание персонала через кассу. Нули до решения по staff-механике
    (backend-todo №9, отложено 13.07.2026)."""

    cost: float = Field(description="Реальные затраты заведения")
    paidSum: float = Field(description="Внутренняя «выручка» по спеццене")
    qty: float = Field(description="Порций")


class Losses(StrictModel):
    compliments: Compliments
    staff: Staff
    writeoffs: None = Field(
        default=None,
        description="Акты списания (порча, бой, бракераж) — null до фазы 2: "
        "источник OLAP TRANSACTIONS ещё не загружается",
    )
    writeoffsGoal: float | None = Field(
        default=None,
        description="Цель списаний в ₽ за месяц из Целей; null — не задана",
    )
    complimentsGoal: float | None = Field(
        default=None,
        description="Цель представительских в ₽ за месяц из Целей; null — не задана",
    )


class Foodcost(StrictModel):
    period: Period = Field(
        description="Показываемый период: месяц последнего закрытого дня "
        "(или ?year/?month)"
    )
    compare: Period = Field(
        description="Период сравнения: непосредственно предшествующий период той же формы"
    )
    totals: CostTotals = Field(
        description="Тоталы страницы («чистый фудкост» в сырье); "
        "равны сумме units по построению"
    )
    dirty: None = Field(
        default=None,
        description="Фудкост с учётом потерь — null до фазы 2: без списаний "
        "число было бы занижено",
    )
    units: list[UnitCost] = Field(
        description="Всегда четыре элемента: k, b, w, o (нулевые включены)"
    )
    groups: list[GroupCost] = Field(
        description="Группы с продажами в period, по убыванию выручки; "
        "группа без продаж в этом периоде не отдаётся"
    )
    discounts: Discounts
    losses: Losses
