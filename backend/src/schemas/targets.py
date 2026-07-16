"""Контракт страницы «Цели» — GET/PUT /api/targets."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator

from src.schemas.base import StrictModel

CategoryKey = Literal["k", "b", "w", "o"]
WriteoffMode = Literal["pct", "rub"]


class TargetsPeriod(StrictModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    label: str


class TargetsReference(StrictModel):
    """Подсказки «факт / темп» — read-only, считаются с бэкенда."""

    label: str
    revenueFact: float
    revenuePace: float


class TargetsRevenue(StrictModel):
    monthPlan: float = Field(ge=0)
    weekProfile: list[float] = Field(min_length=7, max_length=7)

    @field_validator("weekProfile")
    @classmethod
    def non_negative_weights(cls, value: list[float]) -> list[float]:
        return [max(0.0, float(w)) for w in value]


class TargetsFoodcostUnit(StrictModel):
    key: CategoryKey
    name: str
    goalPct: float = Field(ge=0, le=100)
    factPct: float = Field(ge=0)


class TargetsWriteoffUnit(StrictModel):
    key: CategoryKey
    name: str
    mode: WriteoffMode
    pct: float = Field(ge=0, le=100)
    rub: float = Field(ge=0)


class TargetsCompliments(StrictModel):
    goalPct: float = Field(ge=0, le=100)
    factPct: float = Field(ge=0)
    factRub: float = Field(ge=0)


class TargetsInventory(StrictModel):
    goalPct: float = Field(ge=0, le=100)
    note: str


class TargetsData(StrictModel):
    period: TargetsPeriod
    reference: TargetsReference
    revenue: TargetsRevenue
    dailyOverrides: dict[str, float] = Field(
        default_factory=dict,
        description='Переопределения дневных планов: ключ — день месяца ("1"…"31")',
    )
    foodcost: list[TargetsFoodcostUnit]
    writeoffs: list[TargetsWriteoffUnit]
    compliments: TargetsCompliments
    inventory: TargetsInventory


class TargetsUpsertRequest(StrictModel):
    """Тело PUT — без reference/fact (их бэкенд пересчитывает)."""

    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    revenue: TargetsRevenue
    dailyOverrides: dict[str, float] = Field(default_factory=dict)
    foodcost: list[TargetsFoodcostUnit] = Field(default_factory=list)
    writeoffs: list[TargetsWriteoffUnit] = Field(default_factory=list)
    complimentsGoalPct: float = Field(ge=0, le=100)
    inventoryGoalPct: float = Field(ge=0, le=100)

    @field_validator("dailyOverrides")
    @classmethod
    def validate_overrides(cls, value: dict[str, float]) -> dict[str, float]:
        cleaned: dict[str, float] = {}
        for key, amount in value.items():
            day = int(key)
            if day < 1 or day > 31:
                raise ValueError("dailyOverrides keys must be days 1–31")
            cleaned[str(day)] = max(0.0, float(amount))
        return cleaned
