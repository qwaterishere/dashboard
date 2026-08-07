"""Контракт API страницы «Фудкост»."""

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
        description="Цель фудкоста, %; null — цель месяца не задана в Целях"
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
        "(живой разрез номенклатуры)"
    )
    goal: float | None = Field(
        default=None,
        description="Цель % (наследуется от юнита в Целях); null — нет цели",
    )


class ProductCost(StrictModel):
    """Позиция диаграммы «Выгодность позиций по фудкосту».

    Только фудкост-строки (paid > 0 и cost > 0) — позиция
    без техкарты в рейтинге выгодности лгала бы (fc 0%). Производные —
    зона фронтенда: цена порции = revenue / qty, себестоимость порции =
    cost / qty, fc = cost / revenue; топ-N и порог шума — представление.
    """

    id: str | None = Field(
        description="UUID блюда в iiko — стабильная идентичность позиции "
        "(имя меняется, id — никогда; как productId на складе). "
        "null — историческая строка без dish_id (база до пересоздания)"
    )
    name: str = Field(
        description="Актуальное имя: из ПОСЛЕДНЕЙ продажи периода — "
        "переименованное блюдо не двоится, отдаётся одной строкой "
        "под новым именем (идентичность по id)"
    )
    unit: Literal['k', 'b', 'w', 'o'] = Field(
        description="Юнит позиции; 'o' — вне подразделений (в фильтрах "
        "юнитов на фронте не участвует, в режиме «Всё» — да)"
    )
    qty: float = Field(description="Порций за период; дробное у весовых")
    revenue: float = Field(
        description="Выручка фудкост-строк позиции (= её revenueWithCost: "
        "множество строк одно)"
    )
    listValue: float = Field(
        description="Прейскурантная выручка тех же строк (Σ цен меню, "
        "БЕЗ скидок). Цена меню порции = listValue / qty — её показывать "
        "«Ценой» в тултипе; скидки позиции = listValue − revenue. "
        "fc считать от revenue (фактическая экономика), НЕ от listValue"
    )
    cost: float = Field(description="Себестоимость фудкост-строк позиции")


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
    """Питание персонала через кассу. Пока всегда нули — фильтр is_staff не реализован."""

    cost: float = Field(description="Реальные затраты заведения")
    paidSum: float = Field(description="Внутренняя «выручка» по спеццене")
    qty: float = Field(description="Порций")


class WriteoffCategory(StrictModel):
    """Категория актов списания — маркерный резолвер счетов iiko."""

    key: str = Field(
        description="Тип потери: spoilage/brak/tasting/compliment/staff/"
        "blogger/marketing/deletion/operational/hotel/other. "
        "Локализация и выбор отображаемых — зона фронтенда"
    )
    sum: float = Field(description="Сумма списаний категории за период")
    rows: int = Field(description="Число строк-актов (день х счёт х продукт)")


class Writeoffs(StrictModel):
    """Акты списания за период. Отдаём ВСЕ категории — какие рисовать,
    решает фронт (далее — настройка ресторана). Сторно исключены из сумм."""

    total: float = Field(description="Сумма всех категорий")
    categories: list[WriteoffCategory] = Field(
        description="Только ненулевые, по убыванию суммы"
    )
    prevTotal: float | None = Field(
        description="Сумма за compare-период; null — период не покрыт "
        "данными домена (синк списаний моложе периода)"
    )
    stornoCount: int = Field(
        description="Минусовых проводок на счетах потерь в периоде — "
        "сноска для фронта, в total НЕ входят"
    )
    stornoSum: float = Field(
        description="Их суммарный минус (отрицательное число)"
    )


class Losses(StrictModel):
    compliments: Compliments
    staff: Staff
    writeoffs: Writeoffs | None = Field(
        default=None,
        description="Акты списания по категориям; null — запрошенный период "
        "старше первых загруженных актов (честное «данных нет», а не ноль)",
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
        description="Фудкост с учётом потерь — null: состав (какие категории "
        "списаний включать в процент) задаст настройка ресторана — "
        "управляющий выбирает сам; до неё число не отдаём",
    )
    units: list[UnitCost] = Field(
        description="Всегда четыре элемента: k, b, w, o (нулевые включены)"
    )
    groups: list[GroupCost] = Field(
        description="Группы с продажами в period, по убыванию выручки; "
        "группа без продаж в этом периоде не отдаётся"
    )
    products: list[ProductCost] = Field(
        description="ВСЕ позиции с техкартами за period (без топ-N "
        "и порога шума — рейтинг и фильтры строит фронт), "
        "по убыванию выручки. Кормит диаграмму «Выгодность позиций»"
    )
    discounts: Discounts
    losses: Losses
