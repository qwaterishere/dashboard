"""CLI-загрузчик актов списания (WRITEOFF).

Админский ручной/бэкфилл-инструмент: штатный путь — шедулер и UI sync
(run_sync_job), который ежедневно перечитывает окно RESYNC_DAYS.
Здесь можно задать произвольный диапазон для исторической заливки.

    python -m src.cli.writeoffs_loader                        # все настроенные
    python -m src.cli.writeoffs_loader --restaurant-id <uuid>
    python -m src.cli.writeoffs_loader --from 2026-05-01 --to 2026-07-31
"""
import argparse
import datetime
import sys
import uuid

from src.db.bootstrap import ensure_dev_schema
from src.db.models.restaurant import Restaurant
from src.db.session import db_manager
from src.services.writeoffs_sync import sync_restaurant_writeoffs


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Загрузка актов списания из iiko")
    parser.add_argument(
        "--restaurant-id",
        dest="restaurant_id",
        type=uuid.UUID,
        default=None,
        metavar="UUID",
        help="один ресторан; без параметра — все с настроенным iiko",
    )
    parser.add_argument(
        "--from",
        dest="date_from",
        type=datetime.date.fromisoformat,
        default=None,
        metavar="ГГГГ-ММ-ДД",
        help="начало диапазона; без дат — штатное окно/бэкфилл",
    )
    parser.add_argument(
        "--to",
        dest="date_to",
        type=datetime.date.fromisoformat,
        default=None,
        metavar="ГГГГ-ММ-ДД",
        help="конец диапазона (включительно)",
    )
    args = parser.parse_args()

    ensure_dev_schema()

    session = db_manager.get_session()
    try:
        query = session.query(Restaurant)
        if args.restaurant_id is not None:
            query = query.filter(Restaurant.id == args.restaurant_id)
        restaurants = [r for r in query.all() if r.iiko_configured]
    finally:
        session.close()

    if not restaurants:
        print("нет ресторанов с настроенным iiko", file=sys.stderr)
        raise SystemExit(1)

    failures = 0
    for restaurant in restaurants:
        print(f"[{restaurant.id}] {restaurant.iiko_url} ...", flush=True)
        try:
            stats = sync_restaurant_writeoffs(
                restaurant,
                date_from=args.date_from,
                date_to=args.date_to,
            )
        except Exception as exc:  # статус error уже записан сервисом
            failures += 1
            print(f"  ОШИБКА: {exc}", file=sys.stderr, flush=True)
            continue
        print(f"  готово: {stats.date_from} — {stats.date_to}, "
              f"строк {stats.rows_seen} (сторно {stats.storno_seen}), "
              f"+{stats.inserted} ~{stats.updated} -{stats.deleted}",
              flush=True)

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
