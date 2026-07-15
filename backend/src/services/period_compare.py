"""Календарные периоды сравнения для LfL KPI."""

from __future__ import annotations

import calendar
from datetime import date, timedelta


def shift_month(year: int, month: int, delta: int = -1) -> tuple[int, int]:
    month += delta
    while month < 1:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    return year, month


def same_period_last_year(d_from: date, d_to: date) -> tuple[date, date]:
    """Те же календарные числа прошлого года; 29 февраля -> 28-е."""

    def shift(d: date) -> date:
        try:
            return d.replace(year=d.year - 1)
        except ValueError:
            return d.replace(year=d.year - 1, day=28)

    return shift(d_from), shift(d_to)


def previous_period(d_from: date, d_to: date) -> tuple[date, date]:
    """Непосредственно предшествующий период той же формы.

    - Полный месяц -> предыдущий полный месяц
    - 1..N внутри месяца -> те же числа предыдущего месяца
    - Произвольный диапазон -> блок той же длины, ending day before d_from
    """
    if d_from > d_to:
        raise ValueError("invalid period")

    if d_from.month == d_to.month and d_from.year == d_to.year:
        days_in_month = calendar.monthrange(d_from.year, d_from.month)[1]
        prev_year, prev_month = shift_month(d_from.year, d_from.month)
        prev_last = calendar.monthrange(prev_year, prev_month)[1]

        if d_from.day == 1 and d_to.day == days_in_month:
            return date(prev_year, prev_month, 1), date(prev_year, prev_month, prev_last)

        if d_from.day == 1:
            prev_from = date(prev_year, prev_month, 1)
            prev_to = date(prev_year, prev_month, min(d_to.day, prev_last))
            return prev_from, prev_to

    length = (d_to - d_from).days + 1
    prev_end = d_from - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end
