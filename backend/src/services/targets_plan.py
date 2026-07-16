"""Распределение месячного плана выручки по дням (профиль недели + overrides)."""

from __future__ import annotations

import calendar
from dataclasses import dataclass


@dataclass(frozen=True)
class MonthDayPlan:
    day: int
    amount: float
    is_override: bool


def week_profile_index(year: int, month: int, day: int) -> int:
    """Индекс профиля (пн=0 … вс=6)."""
    return date_weekday_mon0(year, month, day)


def date_weekday_mon0(year: int, month: int, day: int) -> int:
    return calendar.weekday(year, month, day)  # Mon=0 .. Sun=6


def days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def build_month_day_plans(
    year: int,
    month: int,
    month_plan: float,
    week_profile: list[float],
    overrides: dict[int, float] | None = None,
) -> list[MonthDayPlan]:
    overrides = overrides or {}
    total_days = days_in_month(year, month)
    days = list(range(1, total_days + 1))

    override_total = sum(
        float(overrides[day]) for day in days if day in overrides
    )
    remaining_plan = max(0.0, round(month_plan) - override_total)
    free_days = [day for day in days if day not in overrides]

    weights = []
    for day in free_days:
        index = week_profile_index(year, month, day)
        weight = week_profile[index] if index < len(week_profile) else 1.0
        weights.append(weight if weight and weight > 0 else 1.0)
    weight_sum = sum(weights) or 1.0

    distributed = _distribute_largest_remainder(free_days, weights, weight_sum, remaining_plan)

    by_day: dict[int, MonthDayPlan] = {}
    for day in days:
        if day in overrides:
            by_day[day] = MonthDayPlan(day, round(float(overrides[day])), True)
    for item in distributed:
        by_day.setdefault(item.day, item)

    return [by_day[day] for day in days]


def _distribute_largest_remainder(
    days: list[int],
    weights: list[float],
    weight_sum: float,
    total: float,
) -> list[MonthDayPlan]:
    if not days:
        return []
    total_int = int(round(total))
    raw = [
        (day, (total_int * weights[i]) / weight_sum)
        for i, day in enumerate(days)
    ]
    floored = [
        {"day": day, "amount": int(value // 1), "fraction": value - int(value // 1)}
        for day, value in raw
    ]
    remainder = total_int - sum(item["amount"] for item in floored)
    for item in sorted(floored, key=lambda row: row["fraction"], reverse=True):
        if remainder <= 0:
            break
        item["amount"] += 1
        remainder -= 1

    return [
        MonthDayPlan(day=item["day"], amount=float(item["amount"]), is_override=False)
        for item in floored
    ]
