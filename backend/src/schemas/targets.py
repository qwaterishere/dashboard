"""Контракт страницы «Цели» — GET/PUT /api/targets."""

from __future__ import annotations

from typing import Literal

from pydantic import Field, field_validator, model_validator

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
    """GET: план может быть 0, если месяц ещё не настроен."""

    monthPlan: float = Field(ge=0)
    weekProfile: list[float] = Field(min_length=7, max_length=7)

    @field_validator("weekProfile")
    @classmethod
    def non_negative_weights(cls, value: list[float]) -> list[float]:
        return [max(0.0, float(w)) for w in value]


class TargetsRevenueUpsert(StrictModel):
    """PUT: все поля обязательны и > 0."""

    monthPlan: float = Field(gt=0)
    weekProfile: list[float] = Field(min_length=7, max_length=7)

    @field_validator("weekProfile")
    @classmethod
    def positive_weights(cls, value: list[float]) -> list[float]:
        cleaned = [float(w) for w in value]
        if any(w <= 0 for w in cleaned):
            raise ValueError("weekProfile weights must be > 0")
        return cleaned


class TargetsFoodcostUnit(StrictModel):
    """GET: goalPct может быть 0 до настройки."""

    key: CategoryKey
    name: str
    goalPct: float = Field(ge=0, le=100)
    factPct: float = Field(ge=0)


class TargetsFoodcostUnitUpsert(StrictModel):
    key: CategoryKey
    name: str
    goalPct: float = Field(gt=0, le=100)
    factPct: float = Field(ge=0)


class TargetsWriteoffUnit(StrictModel):
    """GET: суммы могут быть 0 до настройки."""

    key: CategoryKey
    name: str
    mode: WriteoffMode
    pct: float = Field(ge=0, le=100)
    rub: float = Field(ge=0)


class TargetsWriteoffUnitUpsert(StrictModel):
    key: CategoryKey
    name: str
    mode: WriteoffMode
    pct: float = Field(ge=0, le=100)
    rub: float = Field(ge=0)

    @model_validator(mode="after")
    def active_amount_required(self) -> TargetsWriteoffUnitUpsert:
        amount = self.pct if self.mode == "pct" else self.rub
        if amount <= 0:
            raise ValueError("writeoff amount for active mode must be > 0")
        return self


class TargetsCompliments(StrictModel):
    mode: WriteoffMode = "pct"
    goalPct: float = Field(ge=0, le=100)
    goalRub: float = Field(ge=0)
    factPct: float = Field(ge=0)
    factRub: float = Field(ge=0)


class TargetsInventory(StrictModel):
    mode: WriteoffMode = "pct"
    goalPct: float = Field(ge=0, le=100)
    goalRub: float = Field(ge=0)
    note: str


class TargetsAmountGoalUpsert(StrictModel):
    """Цель в % или в валюте — как у списаний."""

    mode: WriteoffMode
    pct: float = Field(ge=0, le=100)
    rub: float = Field(ge=0)

    @model_validator(mode="after")
    def active_amount_required(self) -> TargetsAmountGoalUpsert:
        amount = self.pct if self.mode == "pct" else self.rub
        if amount <= 0:
            raise ValueError("goal amount for active mode must be > 0")
        return self


class TargetsData(StrictModel):
    period: TargetsPeriod
    reference: TargetsReference
    revenue: TargetsRevenue
    dailyOverrides: dict[str, float] = Field(
        default_factory=dict,
        description='Дневные override: ключ — день месяца ("1"…"31")',
    )
    foodcost: list[TargetsFoodcostUnit]
    writeoffs: list[TargetsWriteoffUnit]
    compliments: TargetsCompliments
    inventory: TargetsInventory
    locked: bool = False


class TargetsLockedPeriod(StrictModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    label: str


class TargetsLockedList(StrictModel):
    items: list[TargetsLockedPeriod] = Field(default_factory=list)


class TargetsUpsertRequest(StrictModel):
    """Тело PUT — все обязательные поля заполнены (> 0)."""

    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    revenue: TargetsRevenueUpsert
    dailyOverrides: dict[str, float] = Field(default_factory=dict)
    foodcost: list[TargetsFoodcostUnitUpsert] = Field(min_length=1)
    writeoffs: list[TargetsWriteoffUnitUpsert] = Field(min_length=1)
    compliments: TargetsAmountGoalUpsert
    inventory: TargetsAmountGoalUpsert

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
