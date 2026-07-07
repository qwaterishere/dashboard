"""Shared Pydantic building blocks for stub page schemas."""

from typing import Literal

from src.schemas.base import StrictModel

CategoryKey = Literal["k", "b", "w", "o"]
LflDirection = Literal["up", "dn"]
DiscountTone = Literal["amber"]


class LflMetric(StrictModel):
    pct: float
    dir: LflDirection


class PeriodInfo(StrictModel):
    label: str
    note: str
    compareWith: str | None = None
