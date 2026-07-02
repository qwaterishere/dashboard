"""Shared Pydantic building blocks."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

CategoryKey = Literal["k", "b", "w"]
LflDirection = Literal["up", "dn"]
DiscountTone = Literal["amber"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LflMetric(StrictModel):
    pct: float
    dir: LflDirection


class PeriodInfo(StrictModel):
    label: str
    note: str
    compareWith: str | None = None
