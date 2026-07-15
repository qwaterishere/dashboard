"""Недельные KPI дашборда: LfL-сравнение и производные метрики."""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from src.services.dashboard import _daily, _period_dict, _totals


def previous_week_range(week_start: date, week_end: date) -> tuple[date, date]:
    """Календарная неделя, непосредственно предшествующая week_start..week_end."""
    length = (week_end - week_start).days + 1
    prev_end = week_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


def validate_week_range(week_start: date, week_end: date) -> None:
    if week_end < week_start:
        raise ValueError("weekEnd must be on or after weekStart")
    length = (week_end - week_start).days + 1
    if length != 7:
        raise ValueError("week range must span exactly 7 days")


def _weekday_js(day: date) -> int:
    """0=вс..6=сб — как в контракте RevenueDay."""
    return (day.weekday() + 1) % 7


def _day_stat(day: date, entry: dict) -> dict:
    revenue = float(entry.get("revenue", 0))
    checks = int(entry.get("checks", 0))
    guests = int(entry.get("guests", 0))
    return {
        "date": day,
        "weekday": _weekday_js(day),
        "revenue": round(revenue),
        "checks": checks,
        "guests": guests,
        "avgCheck": round(revenue / checks) if checks else 0,
    }


def _pick_peak_weak(days: list[dict]) -> tuple[dict | None, dict | None]:
    active = [d for d in days if d["checks"] > 0 or d["revenue"] > 0]
    if not active:
        return None, None
    peak = max(active, key=lambda d: d["revenue"])
    weak = min(active, key=lambda d: d["revenue"])
    return peak, weak


def _month_revenue_to_date(
    session: Session,
    restaurant_id: UUID,
    *,
    year: int,
    month: int,
    latest: date | None,
) -> float:
    month_start = date(year, month, 1)
    month_end = date(year, month, calendar.monthrange(year, month)[1])
    if latest is not None:
        if latest < month_start:
            return 0.0
        month_end = min(month_end, latest)
    return _totals(session, restaurant_id, month_start, month_end)["revenue"]


def build_week_kpi_overlay(
    session: Session,
    restaurant_id: UUID,
    *,
    week_start: date,
    week_end: date,
    anchor_year: int,
    anchor_month: int,
    latest: date | None,
    compare_start: date | None = None,
    compare_end: date | None = None,
) -> dict:
    """LfL KPI + weekKpi для overlay поверх месячного ответа дашборда."""
    validate_week_range(week_start, week_end)

    if compare_start is not None and compare_end is not None:
        prev_start, prev_end = compare_start, compare_end
    else:
        prev_start, prev_end = previous_week_range(week_start, week_end)
    cur = _totals(session, restaurant_id, week_start, week_end)
    prev_raw = _totals(session, restaurant_id, prev_start, prev_end)
    prev = prev_raw if prev_raw["checks"] > 0 else None

    daily = _daily(session, restaurant_id, week_start, week_end)
    day = week_start
    day_stats: list[dict] = []
    while day <= week_end:
        entry = daily.get(day, {"revenue": 0.0, "checks": 0, "guests": 0})
        day_stats.append(_day_stat(day, entry))
        day += timedelta(days=1)

    working_days = sum(1 for d in day_stats if d["checks"] > 0 or d["revenue"] > 0)
    peak, weak = _pick_peak_weak(day_stats)
    days_in_week = len(day_stats)

    checks_with_avg = [d["avgCheck"] for d in day_stats if d["checks"] > 0]
    month_revenue = _month_revenue_to_date(
        session,
        restaurant_id,
        year=anchor_year,
        month=anchor_month,
        latest=latest,
    )
    week_revenue = cur["revenue"]
    month_share = (
        round(week_revenue / month_revenue * 1000) / 10
        if month_revenue > 0
        else None
    )

    def metric(name: str) -> dict:
        return {
            "value": cur[name],
            "prevValue": prev[name] if prev else None,
            "forecast": None,
            "forecastToday": None,
        }

    kpis = {
        "revenue": metric("revenue"),
        "checks": metric("checks"),
        "guests": metric("guests"),
        "avgCheck": {
            "value": round(cur["revenue"] / cur["checks"]) if cur["checks"] else 0,
            "prevValue": (
                round(prev_raw["revenue"] / prev_raw["checks"])
                if prev and prev_raw["checks"]
                else None
            ),
            "forecast": None,
            "forecastToday": None,
        },
    }

    week_kpi = {
        "weekStart": week_start,
        "weekEnd": week_end,
        "prevWeekStart": prev_start,
        "prevWeekEnd": prev_end,
        "comparison": "lfl",
        "workingDays": working_days,
        "avgDailyRevenue": round(cur["revenue"] / days_in_week) if days_in_week else 0,
        "avgDailyChecks": round(cur["checks"] / days_in_week) if days_in_week else 0,
        "avgDailyGuests": round(cur["guests"] / days_in_week) if days_in_week else 0,
        "avgCheckMin": min(checks_with_avg) if checks_with_avg else 0,
        "avgCheckMax": max(checks_with_avg) if checks_with_avg else 0,
        "peakDay": peak,
        "weakDay": weak,
        "monthRevenueSharePct": month_share,
    }

    return {
        "kpis": kpis,
        "weekKpi": week_kpi,
        "compare": _period_dict(prev_start, prev_end),
    }
