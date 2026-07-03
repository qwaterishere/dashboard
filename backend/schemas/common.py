"""Shared Pydantic building blocks."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

# 'o' — «вне подразделений»: группы iiko вне папок Кухня/Бар/Вино
# (docs/iiko-setup-standard.md, раздел 1). В донат юнитов не входит,
# в таблице позиций и общей выручке — участвует.
CategoryKey = Literal["k", "b", "w", "o"]
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
