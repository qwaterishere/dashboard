"""CLI-загрузчик продаж iiko в БД.

    python -m src.cli.sales_loader
    python -m src.cli.sales_loader --from 2025-03-01 --to 2025-03-31
"""
import argparse
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func

from src.db.models.sales import Order
from src.db.session import db_manager
from src.integrations.iiko.client import IikoClient
from src.services.sales import parse_records, replace_day


def history_limit(today: date | None = None) -> date:
    today = today or date.today()
    return date(today.year - 1, 1, 1)


def month_chunks(date_from: date, date_to: date):
    cur = date_from
    while cur <= date_to:
        month_end = (cur.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        yield cur, min(month_end, date_to)
        cur = month_end + timedelta(days=1)


def date_chunks(date_from: date, date_to: date, *, chunk_days: int = 1):
    """Дробит диапазон на короткие интервалы для OLAP (iiko рвёт большие ответы)."""
    if chunk_days < 1:
        raise ValueError('chunk_days must be >= 1')
    cur = date_from
    while cur <= date_to:
        end = min(cur + timedelta(days=chunk_days - 1), date_to)
        yield cur, end
        cur = end + timedelta(days=1)


def load_range(date_from: date, date_to: date, *, chunk_days: int = 1) -> None:
    with IikoClient() as client:
        for chunk_from, chunk_to in date_chunks(date_from, date_to, chunk_days=chunk_days):
            raw = client.fetch_sales(chunk_from, chunk_to)
            records = parse_records(raw)

            by_day = defaultdict(list)
            for rec in records:
                by_day[rec.day].append(rec)

            for day in sorted(by_day):
                session = db_manager.get_session()
                try:
                    replace_day(session, day, by_day[day])
                    session.commit()
                except Exception:
                    session.rollback()
                    raise
                finally:
                    session.close()

            print(
                f"{chunk_from} — {chunk_to}: строк {len(raw)}, дней {len(by_day)}",
                flush=True,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Загрузка продаж iiko в БД дашборда")
    parser.add_argument(
        "--from",
        dest="date_from",
        type=date.fromisoformat,
        metavar="ГГГГ-ММ-ДД",
    )
    parser.add_argument(
        "--to",
        dest="date_to",
        type=date.fromisoformat,
        metavar="ГГГГ-ММ-ДД",
    )
    parser.add_argument(
        "--chunk-days",
        dest="chunk_days",
        type=int,
        default=1,
        metavar="N",
        help="дней за один OLAP-запрос (1 — надёжнее, 7 — быстрее при стабильном iiko)",
    )
    args = parser.parse_args()

    yesterday = date.today() - timedelta(days=1)
    date_to = min(args.date_to or yesterday, yesterday)

    db_manager.create_all()

    session = db_manager.get_session()
    try:
        last = session.query(func.max(Order.day)).scalar()
    finally:
        session.close()

    date_from = args.date_from
    if last is None:
        limit = history_limit()
        if date_from is None:
            date_from = limit
        elif date_from < limit:
            print(f"новый проект: глубже {limit} не грузим, {date_from} -> {limit}")
            date_from = limit
    elif date_from is None:
        date_from = last

    if date_from > date_to:
        print(f"нечего загружать: {date_from} позже {date_to}")
        return

    load_range(date_from, date_to, chunk_days=max(1, args.chunk_days))


if __name__ == "__main__":
    main()
