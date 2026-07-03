"""CLI-загрузчик продаж iiko в БД дашборда.

Дозагрузка (по расписанию или руками) — без аргументов:
    python -m src.sales.loader
    # пустая база  -> бэкфилл с 1 января предыдущего года по вчера;
    # иначе        -> от последнего дня в БД (перезагружая его — вдруг
    #                 был неполным) до вчера включительно

Явный период:
    python -m src.sales.loader --from 2025-03-01 --to 2025-03-31

Гарантии:
- первичный бэкфилл НОВОГО проекта (пустая база) — не глубже
  1 января предыдущего года; работающий инстанс копит историю дальше,
  ничего не удаляется, явный --from по своим данным не ограничен;
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


def history_limit(today: date | None = None) -> date:
    """Глубина первичного бэкфилла НОВОГО проекта: 1 января предыдущего года.

    Правило стандарта внедрения: новому внедрению достаточно текущего
    и предыдущего года (LfL покрыт), глубже — лишнее время и объём.
    На дозагрузку работающего инстанса предел не распространяется:
    накопленная история — актив ресторана, она не ограничивается
    и не удаляется.
    """
    today = today or date.today()
    return date(today.year - 1, 1, 1)


def month_chunks(date_from: date, date_to: date):
    """Разбивает диапазон на календарные месяцы (границы включительно)."""
    cur = date_from
    while cur <= date_to:
        month_end = (cur.replace(day=1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        yield cur, min(month_end, date_to)
        cur = month_end + timedelta(days=1)


def load_range(date_from: date, date_to: date) -> None:
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

    # Схема — до первого обращения к БД: загрузчик — самостоятельная
    # точка входа и не полагается на create_all в src/main.py (API может
    # ещё ни разу не запускаться, например при первичном бэкфилле).
    db_manager.create_all()

    session = db_manager.get_session()
    try:
        last = session.query(func.max(Order.day)).scalar()
    finally:
        session.close()

    date_from = args.date_from
    if last is None:
        # Новый проект (пустая база): глубина первичного бэкфилла ограничена
        # текущим + предыдущим годом. Работающего инстанса предел не касается —
        # накопленная им история живёт дальше и не удаляется.
        limit = history_limit()
        if date_from is None:
            date_from = limit
        elif date_from < limit:
            print(f'новый проект: глубже {limit} не грузим '
                  f'(текущий + предыдущий год), {date_from} -> {limit}')
            date_from = limit
    elif date_from is None:
        # дозагрузка: от последнего дня в БД (перезагружая его — мог быть неполным)
        date_from = last

    if date_from > date_to:
        print(f'нечего загружать: {date_from} позже {date_to}')
        return

    load_range(date_from, date_to)


if __name__ == '__main__':
    main()
