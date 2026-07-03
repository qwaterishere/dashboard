"""CLI-загрузчик продаж iiko в БД дашборда.

Бэкфилл истории:
    python -m src.sales.loader --from 2024-01-01 --to 2026-07-01

Дозагрузка (по расписанию или руками) — без аргументов:
    python -m src.sales.loader
    # грузит от последнего дня в БД (перезагружая его — вдруг был неполным)
    # до вчера включительно

Гарантии:
- выгрузка из iiko — помесячно (мало запросов к API);
- запись — по дням, день = транзакция: сбой теряет максимум день,
  перезапуск продолжает с того же места;
- день перезагружается целиком (см. replace_day) — повторные запуски
  идемпотентны и подхватывают правки задним числом;
- сегодняшний (незакрытый) день не грузится никогда.
"""
import argparse
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func

from src.database import db_manager
from src.iiko.client import IikoClient
from src.sales.models import Order
from src.sales.service import parse_records, replace_day


def month_chunks(date_from: date, date_to: date):
    """Разбивает диапазон на календарные месяцы (границы включительно)."""
    cur = date_from
    while cur <= date_to:
        month_end = (cur.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        yield cur, min(month_end, date_to)
        cur = month_end + timedelta(days=1)


def load_range(date_from: date, date_to: date) -> None:
    db_manager.create_all()
    with IikoClient() as client:
        for chunk_from, chunk_to in month_chunks(date_from, date_to):
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

            print(f'{chunk_from} — {chunk_to}: строк {len(raw)}, дней {len(by_day)}',
                  flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description='Загрузка продаж iiko в БД дашборда')
    parser.add_argument('--from', dest='date_from', type=date.fromisoformat,
                        metavar='ГГГГ-ММ-ДД', help='начало периода (по умолчанию: последний день в БД)')
    parser.add_argument('--to', dest='date_to', type=date.fromisoformat,
                        metavar='ГГГГ-ММ-ДД', help='конец периода включительно (по умолчанию: вчера)')
    args = parser.parse_args()

    yesterday = date.today() - timedelta(days=1)
    date_to = min(args.date_to or yesterday, yesterday)   # сегодня не грузим

    date_from = args.date_from
    if date_from is None:
        session = db_manager.get_session()
        try:
            last = session.query(func.max(Order.day)).scalar()
        finally:
            session.close()
        if last is None:
            parser.error('база пуста — укажите --from ГГГГ-ММ-ДД для первичной загрузки')
        date_from = last   # последний день перезагружаем: мог быть неполным

    if date_from > date_to:
        print(f'нечего загружать: {date_from} позже {date_to}')
        return

    load_range(date_from, date_to)


if __name__ == '__main__':
    main()
