"""Операционный бриф «Сейчас важно» — композиция существующих builders.

Период = месяц expected closed day (TZ ресторана), не chart picker.
Пороги считаются здесь; UI-строки — на клиенте.
"""

from __future__ import annotations

import logging
from datetime import date
from uuid import UUID

from sqlalchemy.orm import Session

from src.db.models.restaurant import Restaurant
from src.schemas.attention import (
    AttentionDomains,
    AttentionPeriod,
    AttentionResponse,
    DomainStatus,
    FoodcostAttentionFacts,
    MonthPlanFacts,
    NegativeStockHint,
    RevenuePaceFacts,
)
from src.services.analytics.forecast import build_metric_forecast
from src.services.analytics.queries import period_totals, resolve_period
from src.services.data_freshness import (
    expected_closed_sales_day,
    resolve_restaurant_timezone,
)
from src.services.foodcost import _compliment_sums, foodcost_totals
from src.services.stock import SnapshotNotFound, stock_negative
from src.services.targets import _is_customized, _load_row, load_foodcost_goals

logger = logging.getLogger(__name__)

# Совпадает с frontend dashboard.mapper PACE_RISK_RATIO — канон на сервере.
PACE_RISK_RATIO = 0.98


def build_attention(
    session: Session,
    restaurant: Restaurant,
    *,
    now: date | None = None,
) -> AttentionResponse:
    """Собрать attention payload; домены независимы (partial failure → status)."""
    tz = resolve_restaurant_timezone(restaurant.timezone)
    as_of = now or expected_closed_sales_day(tz)
    period = AttentionPeriod(year=as_of.year, month=as_of.month)

    stock_status, negative = _stock_domain(session, restaurant.id)
    foodcost_status, foodcost = _foodcost_domain(
        session, restaurant.id, period.year, period.month,
    )
    revenue_status, revenue_pace = _revenue_domain(
        session, restaurant.id, period.year, period.month, as_of,
    )
    targets_status, month_plan = _targets_domain(
        session, restaurant.id, period.year, period.month,
    )

    return AttentionResponse(
        asOf=as_of,
        period=period,
        domains=AttentionDomains(
            stock=stock_status,
            foodcost=foodcost_status,
            revenue=revenue_status,
            targets=targets_status,
        ),
        negativeStock=negative,
        foodcost=foodcost,
        revenuePace=revenue_pace,
        monthPlan=month_plan,
    )


def _stock_domain(
    session: Session,
    restaurant_id: UUID,
) -> tuple[DomainStatus, NegativeStockHint | None]:
    try:
        neg = stock_negative(session, restaurant_id)
        return DomainStatus.ready, NegativeStockHint(
            count=neg.count,
            valueAbs=neg.valueAbs,
        )
    except SnapshotNotFound:
        return DomainStatus.empty, None
    except Exception:
        logger.exception("attention stock domain failed")
        return DomainStatus.error, None


def _foodcost_domain(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
) -> tuple[DomainStatus, FoodcostAttentionFacts | None]:
    try:
        d_from, d_to, _e, _l = resolve_period(
            session, restaurant_id, year=year, month=month,
        )
        totals = foodcost_totals(session, restaurant_id, year=year, month=month)
        revenue_with_cost = float(totals.revenueWithCost or 0)
        cost = float(totals.cost or 0)
        clean_pct = (cost / revenue_with_cost * 100) if revenue_with_cost > 0 else 0.0

        compliments = _compliment_sums(session, restaurant_id, d_from, d_to)
        compliments_fact = float(compliments.get("cost") or 0)

        unit_revenues = {}  # weighted totals goal uses units; totals.goal already set
        goals = load_foodcost_goals(
            session, restaurant_id, year, month, unit_revenues=unit_revenues,
        )
        # Prefer totals.goal from foodcost_totals (weighted when units present).
        clean_goal = totals.goal
        if clean_goal is None:
            clean_goal = goals.totals_goal_pct
        clean_configured = clean_goal is not None and clean_goal > 0
        over_goal = bool(clean_configured and clean_pct > clean_goal)

        compliments_goal = float(goals.compliments_goal_rub or 0)
        compliments_over = compliments_goal > 0 and compliments_fact > compliments_goal

        return DomainStatus.ready, FoodcostAttentionFacts(
            cleanPct=round(clean_pct, 2),
            cleanGoal=clean_goal,
            cleanGoalConfigured=clean_configured,
            overGoal=over_goal,
            complimentsFact=compliments_fact,
            complimentsGoal=compliments_goal,
            complimentsOver=compliments_over,
        )
    except Exception:
        logger.exception("attention foodcost domain failed")
        return DomainStatus.error, None


def _revenue_domain(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
    as_of: date,
) -> tuple[DomainStatus, RevenuePaceFacts | None]:
    try:
        d_from, d_to, _e, _latest = resolve_period(
            session, restaurant_id, year=year, month=month,
        )
        # Cap fact window to ops day within month.
        fact_to = min(d_to, as_of)
        if fact_to < d_from:
            return DomainStatus.insufficient, None

        totals = period_totals(session, restaurant_id, d_from, fact_to)
        fact = float(totals.get("revenue") or 0)

        forecast = build_metric_forecast(
            session, restaurant_id, "revenue", d_from, fact_to,
        )
        if not forecast.get("ready"):
            return DomainStatus.insufficient, RevenuePaceFacts(
                risk=False,
                fact=fact,
                pace=None,
            )

        pace_raw = forecast.get("forecast_today")
        pace = float(pace_raw) if pace_raw is not None else None
        risk = bool(pace is not None and pace > 0 and fact < pace * PACE_RISK_RATIO)

        return DomainStatus.ready, RevenuePaceFacts(
            risk=risk,
            fact=fact,
            pace=pace,
        )
    except Exception:
        logger.exception("attention revenue domain failed")
        return DomainStatus.error, None


def _targets_domain(
    session: Session,
    restaurant_id: UUID,
    year: int,
    month: int,
) -> tuple[DomainStatus, MonthPlanFacts | None]:
    try:
        row = _load_row(session, restaurant_id, year, month)
        configured = _is_customized(row)
        return DomainStatus.ready, MonthPlanFacts(configured=configured)
    except Exception:
        logger.exception("attention targets domain failed")
        return DomainStatus.error, None
