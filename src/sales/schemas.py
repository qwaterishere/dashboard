"""Pydantic-схемы домена sales: контракт с внешним миром.

SaleRecord — одна сырая запись выгрузки (одно проданное блюдо + поля его чека).
Валидация происходит на границе: кривая запись отклоняется с точным указанием
поля и причины ДО того, как что-либо попадёт в сессию БД. Здесь же
одним местом задан маппинг имён источника (alias) на наши имена полей.
"""
from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SaleRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # --- блюдо ---
    id: UUID = Field(alias='ItemSaleEvent.Id')
    name: str = Field(alias='DishName')
    cost: Decimal | None = Field(default=None, alias='ProductCostBase.ProductCost')
    price: Decimal = Field(alias='DishSumInt')
    discount: Decimal | None = Field(default=None, alias='DiscountSum')
    dish_category: str = Field(alias='DishCategory')
    dish_group: str = Field(alias='DishGroup')

    # --- чек, к которому оно относится ---
    order_number: int = Field(alias='OrderNum')
    session_number: int = Field(alias='SessionNum')
    day: date = Field(alias='OpenDate.Typed')   # '2026-06-22' -> datetime.date
    guests_number: int = Field(alias='GuestNum')
    pay_type: str = Field(alias='PayTypes.Group')
