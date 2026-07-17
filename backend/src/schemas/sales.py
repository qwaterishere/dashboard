"""Pydantic-схемы домена sales: контракт с внешним миром.

SaleRecord — одна сырая запись выгрузки (одно проданное блюдо + поля его чека).
Валидация происходит на границе: кривая запись отклоняется с точным указанием
поля и причины ДО того, как что-либо попадёт в сессию БД. Здесь же
одним местом задан маппинг имён источника (alias) на наши имена полей.
"""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SaleRecord(BaseModel):
    # str_strip_whitespace: в выгрузке встречаются имена с хвостовыми
    # пробелами ("Бабагануш ...шкой ") — без стрижки это разные блюда
    # для GROUP BY.
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    # --- блюдо ---
    id: UUID = Field(alias="ItemSaleEvent.Id")
    name: str = Field(alias="DishName")
    cost: Decimal | None = Field(default=None, alias="ProductCostBase.ProductCost")
    price: Decimal = Field(alias="DishSumInt") # сумма БЕЗ скидки (прейскурант)
    paid_sum: Decimal = Field(alias="DishDiscountSumInt") # фактически уплачено (= выручка)
    # Порций в строке: кассир пробивает "Эспрессо x3" одной строкой;
    # дробное у весовых блюд. При сплит-оплате iiko делит количество
    # пропорционально долям оплат (проверено: 0.911 + 0.089 = 1).
    amount: Decimal = Field(alias="DishAmountInt")
    discount: Decimal | None = Field(default=None, alias="DiscountSum")
    dish_category: str = Field(alias="DishCategory")
    dish_group: str = Field(alias="DishGroup")
    # Папка 1-го уровня в дереве номенклатуры: определяет юнит (Кухня/Бар/Вино).
    # Для группы, лежащей в корне, iiko возвращает саму группу ->
    # 'вне подразделений' на дашборде. None — блюдо без группы вовсе
    # (встречается в истории 2024 г.) — тоже 'вне подразделений'.
    top_group: str | None = Field(alias="DishGroup.TopParent")

    # --- идентичность справочников (17.07.2026) ---
    # Склейка переименований: имя — снапшот на момент продажи, id вечен.
    # Читающая сторона группирует по id и берёт имя последней продажи.
    dish_id: UUID = Field(alias="DishId")
    group_id: UUID = Field(alias="DishGroup.Id")
    # None — у блюда нет категории (справочник полузаброшен, заполнен
    # не у всех строк). Назначение категорий в продукте ПОКА НЕ
    # ОПРЕДЕЛЕНО — id копим впрок: добавить колонку потом = ещё одна
    # полная перезаливка, а гигиена онбординга (переименование
    # категорий-опечаток типа ',fh') с id переживается бесшовно.
    category_id: UUID | None = Field(default=None, alias="DishCategory.Id")

    # --- чек, к которому оно относится ---
    order_number: int = Field(alias="OrderNum")
    session_number: int = Field(alias="SessionNum")
    day: date = Field(alias="OpenDate.Typed") # '2026-06-22' -> datetime.date
    guests_number: int = Field(alias="GuestNum")
    # None = чек без оплаты (комплименты, стафф): осмысленное состояние,
    # в разрезе "карта/наличные" такие строки должны выпадать.
    pay_type: str | None = Field(alias="PayTypes.Group") # CARD / CASH
    pay_type_name: str | None = Field(alias="PayTypes") # Optima POS / QR / Яндекс / Наличные
    # Тип заказа заполняется кассиром вручную: банкеты ("Конференции")
    # частично закрываются как "Обычный заказ" — разрез занижен.
    order_type: str | None = Field(alias="OrderType")

    @field_validator("dish_category", "dish_group", mode="before")
    @classmethod
    def none_to_placeholder(cls, value):
        """В iiko у блюда может не быть категории/группы (None).

        В БД колонки NOT NULL — для аналитики NULL в GROUP BY хуже,
        чем явная метка.
        """
        return value if value is not None else "Без категории"


class Period(BaseModel):
    label: str = Field(
        description='LEGACY: готовая подпись периода ("02.06 — 01.07.2026"); '
        "умирает в такте 5 — фронт будет форматировать сам из dateFrom/dateTo",
    )
    note: str = Field(description="LEGACY: подстрока-пояснение, умирает вместе с label")
    # --- v2: факты периода --------------------------------------
    dateFrom: date | None = Field(
        default=None,
        description="Начало ФАКТИЧЕСКИ покрытого периода — после дефолта "
        "и усечения краями данных (кейс: запросили по 31-е, закрыто по 16-е). "
        "null — данных нет вовсе",
    )
    dateTo: date | None = Field(
        default=None,
        description="Конец фактически покрытого периода (последний закрытый "
        "день при усечении); null — данных нет",
    )


class SalesPosition(BaseModel):
    """Строка таблицы позиций. Производные считает фронт:
    price = rev/qty, unitCost= cost/qty, gp = rev-cost, fc = cost/rev."""

    name: str = Field(description="Название блюда (как в iiko, пробелы подстрижены)")
    sub: str = Field(
        description="Подкатегория для второго уровня детализации (категория блюда из iiko)",
    )
    cat: str = Field(
        description="Юнит: k кухня, b бар, w вино, o «вне подразделений» "
        "(в донат не входит, в таблице и общей выручке — участвует)",
    )
    qty: float = Field(
        description="Продано порций за период; дробное у весовых блюд (4.5 кг)",
    )
    revenue: float = Field(
        description="Выручка позиции за период — СУММА фактических оплат "
                    "(не произведение qty*price: точность не теряется на округлении)",
    )
    listValue: float = Field(
        description="Прейскурантная выручка (Σ цен меню без скидок): "
        "цена меню = listValue/qty (круглая, если цена в периоде "
        "не менялась); скидки позиции = listValue − revenue",
    )
    cost: float = Field(
        description="Суммарная себестоимость проданного за период; "
                    "0 = техкарты нет (fc и gp позиции показывать «—», не 0%)",
    )
    # --- legacy v1 (переходный период) ---------------------------------
    # Средние на порцию; фронт восстанавливает из них выручку с потерей
    # копеек. Удаляются после миграции фронта на revenue/cost.
    price: float = Field(
        description="Средняя фактическая цена порции (со скидками, = выручка/qty)",
    )
    unitCost: float = Field(description="Средняя себестоимость порции")


class SalesPage(BaseModel):
    period: Period
    positions: list[SalesPosition] = Field(
        description="Агрегат по блюдам за период; позиции с нулевой оплатой "
        "(проработки, включённые в банкет) исключены",
    )
