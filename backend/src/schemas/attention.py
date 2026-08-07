"""Контракт GET /api/attention — операционный бриф «Сейчас важно».

Факты + evaluated flags. UI-строки и CTA — зона фронтенда.
"""

from __future__ import annotations

import datetime as dt
from enum import Enum

from pydantic import Field

from .base import StrictModel


class DomainStatus(str, Enum):
    ready = "ready"
    empty = "empty"
    error = "error"
    insufficient = "insufficient"


class AttentionPeriod(StrictModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)


class AttentionDomains(StrictModel):
    stock: DomainStatus
    foodcost: DomainStatus
    revenue: DomainStatus
    targets: DomainStatus


class NegativeStockHint(StrictModel):
    count: int = Field(ge=0)
    valueAbs: float = Field(ge=0)


class FoodcostAttentionFacts(StrictModel):
    cleanPct: float
    cleanGoal: float | None
    cleanGoalConfigured: bool
    overGoal: bool
    complimentsFact: float = Field(ge=0)
    complimentsGoal: float = Field(ge=0)
    complimentsOver: bool


class RevenuePaceFacts(StrictModel):
    """Статистический pace (forecast_today), не month plan."""

    risk: bool
    fact: float = Field(ge=0)
    pace: float | None = Field(default=None, ge=0)


class MonthPlanFacts(StrictModel):
    configured: bool


class AttentionResponse(StrictModel):
    asOf: dt.date
    period: AttentionPeriod
    domains: AttentionDomains
    negativeStock: NegativeStockHint | None = None
    foodcost: FoodcostAttentionFacts | None = None
    revenuePace: RevenuePaceFacts | None = None
    monthPlan: MonthPlanFacts | None = None
