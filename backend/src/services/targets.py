"""Сервис месячных целей: CRUD + проекции для dashboard/foodcost."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.db.models.sales import Order
from src.db.models.targets import MonthlyTarget
from src.schemas.targets import (
    TargetsCompliments,
    TargetsData,
    TargetsFoodcostUnit,
    TargetsInventory,
    TargetsPeriod,
    TargetsReference,
    TargetsRevenue,
    TargetsUpsertRequest,
    TargetsWriteoffUnit,
)
from src.services.targets_plan import build_month_day_plans

UNIT_KEYS = ("k", "b", "w", "o")

_MONTH_GENITIVE = (
    "",
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
)

_MONTH_NOMINATIVE = (
    "",
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
)

_UNIT_NAMES = {"k": "Кухня", "b": "Бар", "w": "Вино", "o": "Прочее"}

# Шаблон месяца (stubs/data/targets.json) — без наследования из прошлого месяца.
DEFAULT_REVENUE_MONTH_PLAN = 11_800_000.0
DEFAULT_WEEK_PROFILE = [1.0, 1.0, 1.0, 1.05, 1.1, 1.2, 1.15]
DEFAULT_FOODCOST_GOALS = {"k": 30.0, "b": 24.0}
DEFAULT_COMPLIMENTS_GOAL_PCT = 0.4
DEFAULT_INVENTORY_GOAL_PCT = 0.15
_DEFAULT_FOODCOST_KEYS = ("k", "b")


@dataclass(frozen=True)
class TargetsRevenuePlans:
    month_plan: float | None
    day_plans: dict[int, float]  # day-of-month → amount
    updated_at_ts: int


@dataclass(frozen=True)
class TargetsFoodcostGoals:
    totals_goal_pct: float | None
    unit_goal_pct: dict[str, float]
    writeoffs_goal_rub: float | None
    compliments_goal_rub: float | None


def resolve_targets_period(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
) -> tuple[int, int]:
    """Период редактирования: query или месяц последнего закрытого дня."""
    if year is not None and month is not None:
        return year, month
    latest = session.scalar(
        select(func.max(Order.day)).where(Order.restaurant_id == restaurant_id)
    )
    if latest is None:
        today = date.today()
        return today.year, today.month
    return latest.year, latest.month


def build_targets(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int | None = None,
    month: int | None = None,
) -> TargetsData:
    y, m = resolve_targets_period(session, restaurant_id, year=year, month=month)
    row = _load_row(session, restaurant_id, y, m)
    reference = _build_reference(session, restaurant_id, y, m)
    foodcost_facts = _foodcost_facts(session, restaurant_id, y, m)

    if not _is_customized(row):
        return _default_targets(y, m, reference, foodcost_facts)

    week_profile = list(row.week_profile or DEFAULT_WEEK_PROFILE)
    if len(week_profile) != 7:
        week_profile = DEFAULT_WEEK_PROFILE[:]

    daily_overrides = {
        str(int(k)): float(v)
        for k, v in (row.daily_overrides or {}).items()
    }

    foodcost_goals = row.foodcost_goals or {}
    foodcost_units = [
        TargetsFoodcostUnit(
            key=key,  # type: ignore[arg-type]
            name=_UNIT_NAMES[key],
            goalPct=float(foodcost_goals.get(key, DEFAULT_FOODCOST_GOALS.get(key, 0.0))),
            factPct=foodcost_facts.get(key, 0.0),
        )
        for key in _DEFAULT_FOODCOST_KEYS
    ]

    writeoffs_raw = row.writeoffs or []
    writeoffs = [
        TargetsWriteoffUnit(
            key=item.get("key", "k"),
            name=item.get("name") or _UNIT_NAMES.get(item.get("key", "k"), item.get("key", "")),
            mode=item.get("mode", "pct"),
            pct=float(item.get("pct", 0.0)),
            rub=float(item.get("rub", 0.0)),
        )
        for item in writeoffs_raw
        if item.get("key") in _UNIT_NAMES
    ]
    if not writeoffs:
        writeoffs = _default_writeoffs(float(row.revenue_month_plan or DEFAULT_REVENUE_MONTH_PLAN))

    return TargetsData(
        period=TargetsPeriod(year=y, month=m, label=_period_label(y, m)),
        reference=reference,
        revenue=TargetsRevenue(
            monthPlan=float(row.revenue_month_plan or 0.0),
            weekProfile=week_profile,
        ),
        dailyOverrides=daily_overrides,
        foodcost=foodcost_units,
        writeoffs=writeoffs,
        compliments=TargetsCompliments(
            goalPct=float(row.compliments_goal_pct or 0.0),
            factPct=0.0,
            factRub=0.0,
        ),
        inventory=TargetsInventory(
            goalPct=float(row.inventory_goal_pct or 0.0),
            note="факта нет — домен фазы 2",
        ),
    )


def save_targets(
    session: Session,
    restaurant_id: UUID,
    payload: TargetsUpsertRequest,
) -> TargetsData:
    row = _load_row(session, restaurant_id, payload.year, payload.month)
    if row is None:
        row = MonthlyTarget(
            restaurant_id=restaurant_id,
            year=payload.year,
            month=payload.month,
        )
        session.add(row)

    row.revenue_month_plan = float(payload.revenue.monthPlan)
    row.week_profile = list(payload.revenue.weekProfile)
    row.daily_overrides = dict(payload.dailyOverrides)
    row.foodcost_goals = {
        unit.key: float(unit.goalPct) for unit in payload.foodcost if unit.key in UNIT_KEYS
    }
    row.writeoffs = [
        {
            "key": unit.key,
            "name": unit.name,
            "mode": unit.mode,
            "pct": float(unit.pct),
            "rub": float(unit.rub),
        }
        for unit in payload.writeoffs
    ]
    row.compliments_goal_pct = float(payload.complimentsGoalPct)
    row.inventory_goal_pct = float(payload.inventoryGoalPct)

    session.commit()
    session.refresh(row)
    return build_targets(session, restaurant_id, year=payload.year, month=payload.month)


def load_revenue_plans(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
) -> TargetsRevenuePlans:
    """Дневные/месячные планы для dashboard: кастом или шаблон месяца."""
    row = _load_row(session, restaurant_id, year, month)
    month_plan, week_profile, overrides, updated_at_ts = _revenue_plan_inputs(row)

    plans = build_month_day_plans(
        year,
        month,
        month_plan,
        week_profile,
        overrides,
    )
    return TargetsRevenuePlans(
        month_plan=month_plan,
        day_plans={p.day: p.amount for p in plans},
        updated_at_ts=updated_at_ts,
    )


def load_foodcost_goals(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
    *,
    unit_revenues: dict[str, float] | None = None,
) -> TargetsFoodcostGoals:
    row = _load_row(session, restaurant_id, year, month)
    if _is_customized(row):
        unit_goal_pct = {
            key: float(value)
            for key, value in (row.foodcost_goals or {}).items()
            if key in UNIT_KEYS
        }
        month_plan = float(row.revenue_month_plan or 0.0)
        writeoffs = row.writeoffs or []
        compliments_pct = float(row.compliments_goal_pct or 0.0)
    else:
        unit_goal_pct = dict(DEFAULT_FOODCOST_GOALS)
        month_plan = DEFAULT_REVENUE_MONTH_PLAN
        writeoffs = [
            {
                "key": unit.key,
                "name": unit.name,
                "mode": unit.mode,
                "pct": unit.pct,
                "rub": unit.rub,
            }
            for unit in _default_writeoffs(month_plan)
        ]
        compliments_pct = DEFAULT_COMPLIMENTS_GOAL_PCT

    if not unit_goal_pct:
        unit_goal_pct = dict(DEFAULT_FOODCOST_GOALS)

    totals_goal = _weighted_goal_pct(unit_goal_pct, unit_revenues or {})
    writeoffs_goal = _writeoffs_goal_rub(writeoffs, month_plan)
    compliments_goal = (
        round(month_plan * compliments_pct / 100.0)
        if month_plan > 0 and compliments_pct > 0
        else None
    )

    return TargetsFoodcostGoals(
        totals_goal_pct=totals_goal,
        unit_goal_pct=unit_goal_pct,
        writeoffs_goal_rub=writeoffs_goal,
        compliments_goal_rub=compliments_goal,
    )


def targets_version_token(session: Session, restaurant_id: UUID) -> int:
    """max(updated_at) для инвалидации ETag dashboard/foodcost."""
    latest = session.scalar(
        select(func.max(MonthlyTarget.updated_at)).where(
            MonthlyTarget.restaurant_id == restaurant_id
        )
    )
    if latest is None:
        return 0
    return int(latest.timestamp())


def _load_row(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
) -> MonthlyTarget | None:
    return session.scalar(
        select(MonthlyTarget).where(
            MonthlyTarget.restaurant_id == restaurant_id,
            MonthlyTarget.year == year,
            MonthlyTarget.month == month,
        )
    )


def _is_customized(row: MonthlyTarget | None) -> bool:
    """Месяц считается заданным, если сохранён положительный план выручки."""
    return row is not None and float(row.revenue_month_plan or 0.0) > 0


def _revenue_plan_inputs(
    row: MonthlyTarget | None,
) -> tuple[float, list[float], dict[int, float], int]:
    if not _is_customized(row):
        return DEFAULT_REVENUE_MONTH_PLAN, DEFAULT_WEEK_PROFILE[:], {}, 0

    week_profile = list(row.week_profile or DEFAULT_WEEK_PROFILE)
    if len(week_profile) != 7:
        week_profile = DEFAULT_WEEK_PROFILE[:]
    overrides = {int(k): float(v) for k, v in (row.daily_overrides or {}).items()}
    updated = row.updated_at
    ts = int(updated.timestamp()) if updated is not None else 0
    return float(row.revenue_month_plan), week_profile, overrides, ts


def _default_targets(
    year: int,
    month: int,
    reference: TargetsReference,
    foodcost_facts: dict[str, float],
) -> TargetsData:
    month_plan = DEFAULT_REVENUE_MONTH_PLAN
    return TargetsData(
        period=TargetsPeriod(year=year, month=month, label=_period_label(year, month)),
        reference=reference,
        revenue=TargetsRevenue(monthPlan=month_plan, weekProfile=DEFAULT_WEEK_PROFILE[:]),
        dailyOverrides={},
        foodcost=[
            TargetsFoodcostUnit(
                key=key,  # type: ignore[arg-type]
                name=_UNIT_NAMES[key],
                goalPct=DEFAULT_FOODCOST_GOALS[key],
                factPct=foodcost_facts.get(key, 0.0),
            )
            for key in _DEFAULT_FOODCOST_KEYS
        ],
        writeoffs=_default_writeoffs(month_plan),
        compliments=TargetsCompliments(
            goalPct=DEFAULT_COMPLIMENTS_GOAL_PCT,
            factPct=0.0,
            factRub=0.0,
        ),
        inventory=TargetsInventory(
            goalPct=DEFAULT_INVENTORY_GOAL_PCT,
            note="факта нет — домен фазы 2",
        ),
    )


def _default_writeoffs(month_plan: float) -> list[TargetsWriteoffUnit]:
    kitchen_pct, bar_pct = 1.2, 0.8
    return [
        TargetsWriteoffUnit(
            key="k",
            name="Кухня",
            mode="pct",
            pct=kitchen_pct,
            rub=round(month_plan * kitchen_pct / 100.0),
        ),
        TargetsWriteoffUnit(
            key="b",
            name="Бар",
            mode="pct",
            pct=bar_pct,
            rub=round(month_plan * bar_pct / 100.0),
        ),
    ]


def _period_label(year: int, month: int) -> str:
    return f"{_MONTH_NOMINATIVE[month]} {year}"


def _build_reference(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
) -> TargetsReference:
    """Факт предыдущего месяца (MTD по числу дней текущего закрытия) + темп."""
    first = date(year, month, 1)
    prev_last = first - timedelta(days=1)
    prev_year, prev_month = prev_last.year, prev_last.month
    prev_days = calendar.monthrange(prev_year, prev_month)[1]

    latest = session.scalar(
        select(func.max(Order.day)).where(Order.restaurant_id == restaurant_id)
    )
    if latest is not None and latest.year == year and latest.month == month:
        mtd_days = min(latest.day, prev_days)
    elif latest is not None and (latest.year, latest.month) == (prev_year, prev_month):
        mtd_days = latest.day
    else:
        mtd_days = prev_days

    d_from = date(prev_year, prev_month, 1)
    d_to = date(prev_year, prev_month, mtd_days)
    fact = float(
        session.scalar(
            select(func.coalesce(func.sum(Order.paid_total), 0)).where(
                Order.restaurant_id == restaurant_id,
                Order.day >= d_from,
                Order.day <= d_to,
            )
        )
        or 0.0
    )
    pace = round(fact / mtd_days * prev_days) if mtd_days > 0 else 0.0
    label = (
        f"{_MONTH_GENITIVE[prev_month]} (1–{mtd_days})"
        if mtd_days < prev_days
        else _MONTH_GENITIVE[prev_month]
    )
    return TargetsReference(label=label, revenueFact=round(fact), revenuePace=pace)


def _foodcost_facts(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
) -> dict[str, float]:
    """Факт фудкоста % предыдущего месяца по юнитам — для зелёных подсказок."""
    from src.services.foodcost import _unit_cost_sums

    first = date(year, month, 1)
    prev_last = first - timedelta(days=1)
    d_from = date(prev_last.year, prev_last.month, 1)
    units = _unit_cost_sums(session, restaurant_id, d_from, prev_last)
    result: dict[str, float] = {}
    for key in _DEFAULT_FOODCOST_KEYS:
        u = units.get(key, {"cost": 0.0, "revenueWithCost": 0.0})
        denom = u["revenueWithCost"]
        result[key] = round((u["cost"] / denom) * 100, 1) if denom > 0 else 0.0
    return result


def _weighted_goal_pct(
    unit_goals: dict[str, float],
    unit_revenues: dict[str, float],
) -> float | None:
    if not unit_goals:
        return None
    weight_sum = sum(unit_revenues.get(k, 0.0) for k in unit_goals)
    if weight_sum > 0:
        return round(
            sum(unit_goals[k] * unit_revenues.get(k, 0.0) for k in unit_goals) / weight_sum,
            2,
        )
    return round(sum(unit_goals.values()) / len(unit_goals), 2)


def _writeoffs_goal_rub(writeoffs: list[dict], month_plan: float) -> float | None:
    if month_plan <= 0 and not writeoffs:
        return None
    total = 0.0
    has_any = False
    for item in writeoffs:
        mode = item.get("mode", "pct")
        if mode == "rub":
            rub = float(item.get("rub", 0.0))
            if rub > 0:
                has_any = True
                total += rub
        else:
            pct = float(item.get("pct", 0.0))
            if pct > 0 and month_plan > 0:
                has_any = True
                total += month_plan * pct / 100.0
    return round(total) if has_any else None
