"""Канон порога темпа (pace risk) — единый источник для attention и forecast API."""

from __future__ import annotations

# fact < pace * ratio → risk (красный трек / attention revenuePace).
PACE_RISK_RATIO = 0.98


def is_pace_risk(fact: float, pace: float | None) -> bool:
    """True, если факт отстаёт от ожидаемого темпа сильнее порога."""
    return bool(pace is not None and pace > 0 and fact < pace * PACE_RISK_RATIO)
