"""Общие правила периода для analytics REST и page-ответов."""

from __future__ import annotations

from datetime import date


def period_dict(d_from: date, d_to: date) -> dict:
    """Канонический Period DTO (year/month/dayFrom/dayTo) для page-совместимых ответов."""
    return {
        'year': d_from.year,
        'month': d_from.month,
        'dayFrom': d_from.day,
        'dayTo': d_to.day,
    }
