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
    id: UUID = Field(alias='ItemSaleEvent.Id')
    name: str = Field(alias='DishName')
    cost: Decimal | None = Field(default=None, alias='ProductCostBase.ProductCost')
    price: Decimal = Field(alias='DishSumInt')                # сумма БЕЗ скидки (прейскурант)
    paid_sum: Decimal = Field(alias='DishDiscountSumInt')     # фактически уплачено (= выручка)
    # Порций в строке: кассир пробивает "Эспрессо x3" одной строкой;
    # дробное у весовых блюд. При сплит-оплате iiko делит количество
    # пропорционально долям оплат (проверено: 0.911 + 0.089 = 1).
    amount: Decimal = Field(alias='DishAmountInt')
    discount: Decimal | None = Field(default=None, alias='DiscountSum')
    dish_category: str = Field(alias='DishCategory')
    dish_group: str = Field(alias='DishGroup')
    # Папка 1-го уровня в дереве номенклатуры: определяет юнит (Кухня/Бар/Вино).
    # Для группы, лежащей в корне, iiko возвращает саму группу ->
    # 'вне подразделений' на дашборде.
    top_group: str = Field(alias='DishGroup.TopParent')

    @field_validator('dish_category', 'dish_group', mode='before')
    @classmethod
    def none_to_placeholder(cls, value):
        """В iiko у блюда может не быть категории/группы (None).

        В БД колонки NOT NULL — для аналитики NULL в GROUP BY хуже,
        чем явная метка.
        """
        return value if value is not None else 'Без категории'

    # --- чек, к которому оно относится ---
    order_number: int = Field(alias='OrderNum')
    session_number: int = Field(alias='SessionNum')
    day: date = Field(alias='OpenDate.Typed')   # '2026-06-22' -> datetime.date
    guests_number: int = Field(alias='GuestNum')
    # None = чек без оплаты (комплименты, стафф): осмысленное состояние,
    # в разрезе "карта/наличные" такие строки должны выпадать.
    pay_type: str | None = Field(alias='PayTypes.Group')       # CARD / CASH
    pay_type_name: str | None = Field(alias='PayTypes')        # Optima POS / QR / Яндекс / Наличные
    # Тип заказа заполняется кассиром вручную: банкеты ("Конференции")
    # частично закрываются как "Обычный заказ" — разрез занижен.
    order_type: str | None = Field(alias='OrderType')


# --- ответы API (контракт с фронтендом, структура data/sales.json) ---

class Period(BaseModel):
    label: str
    note: str


class SalesPosition(BaseModel):
    """Строка таблицы позиций: фронтенд сам считает rev = qty*price и т.д."""
    name: str
    sub: str        # подкатегория (категория iiko)
    cat: str        # юнит: k / b / w
    qty: float       # порций (дробное у весовых блюд)
    price: float     # средняя фактическая цена за порцию
    unitCost: float  # средняя себестоимость за порцию


class SalesPage(BaseModel):
    period: Period
    positions: list[SalesPosition]
