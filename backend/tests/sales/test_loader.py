"""Тесты правил загрузчика (без сети)."""

from datetime import date

from src.cli.sales_loader import history_limit, month_chunks


def test_history_limit_is_jan1_of_previous_year():
    assert history_limit(date(2026, 7, 3)) == date(2025, 1, 1)
    assert history_limit(date(2026, 1, 1)) == date(2025, 1, 1)   # окно сдвигается 1 января
    assert history_limit(date(2027, 1, 1)) == date(2026, 1, 1)


def test_month_chunks_split_and_bounds():
    chunks = list(month_chunks(date(2026, 5, 15), date(2026, 7, 2)))
    assert chunks == [
        (date(2026, 5, 15), date(2026, 5, 31)),   # неполный первый месяц
        (date(2026, 6, 1), date(2026, 6, 30)),
        (date(2026, 7, 1), date(2026, 7, 2)),     # неполный последний
    ]


def test_month_chunks_single_day():
    assert list(month_chunks(date(2026, 6, 1), date(2026, 6, 1))) == [
        (date(2026, 6, 1), date(2026, 6, 1)),
    ]
