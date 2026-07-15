"""Тесты календарных периодов сравнения LfL."""

from datetime import date

import pytest

from src.services.period_compare import previous_period, same_period_last_year


def test_previous_period_partial_month():
    assert previous_period(date(2026, 6, 1), date(2026, 6, 11)) == (
        date(2026, 5, 1),
        date(2026, 5, 11),
    )


def test_previous_period_full_month():
    assert previous_period(date(2026, 6, 1), date(2026, 6, 30)) == (
        date(2026, 5, 1),
        date(2026, 5, 31),
    )


def test_previous_period_january_rolls_to_december():
    assert previous_period(date(2026, 1, 1), date(2026, 1, 15)) == (
        date(2025, 12, 1),
        date(2025, 12, 15),
    )


def test_previous_period_arbitrary_range():
    assert previous_period(date(2026, 6, 8), date(2026, 6, 14)) == (
        date(2026, 6, 1),
        date(2026, 6, 7),
    )


def test_previous_period_rejects_inverted_range():
    with pytest.raises(ValueError, match="invalid period"):
        previous_period(date(2026, 6, 10), date(2026, 6, 1))


def test_same_period_last_year_leap_day():
    assert same_period_last_year(date(2024, 2, 29), date(2024, 2, 29)) == (
        date(2023, 2, 28),
        date(2023, 2, 28),
    )
