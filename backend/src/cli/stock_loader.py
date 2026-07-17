"""CLI-загрузчик слепков остатков склада (домен stock, карточка №13).

Единственный ручной вход синка склада (решение 7: потребителю недоступен;
штатный путь — шедулер). Инкрементален от последнего слепка; первый
запуск — бэкфилл BACKFILL_DAYS дней.

    python -m src.cli.stock_loader                       # все настроенные рестораны
    python -m src.cli.stock_loader --restaurant-id <uuid>
    python -m src.cli.stock_loader --backfill-days 30
"""
import argparse
import sys
import uuid

from src.db.models.restaurant import Restaurant
from src.db.session import db_manager
from src.services.warehouse_sync import BACKFILL_DAYS, sync_restaurant_stock


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Загрузка слепков остатков склада из iiko")
    parser.add_argument(
        "--restaurant-id",
        dest="restaurant_id",
        type=uuid.UUID,
        default=None,
        metavar="UUID",
        help="один ресторан; без параметра — все с настроенным iiko",
    )
    parser.add_argument(
        "--backfill-days",
        dest="backfill_days",
        type=int,
        default=BACKFILL_DAYS,
        metavar="N",
        help=f"глубина первого бэкфила в днях (дефолт {BACKFILL_DAYS})",
    )
    args = parser.parse_args()

    db_manager.create_all()

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
            stats = sync_restaurant_stock(
                restaurant, backfill_days=max(1, args.backfill_days))
        except Exception as exc:  # статус error уже записан сервисом
            failures += 1
            print(f"  ОШИБКА: {exc}", file=sys.stderr, flush=True)
            continue
        if stats.days_loaded == 0:
            print("  актуально: новых закрытых дней нет", flush=True)
        else:
            print(f"  готово: {stats.date_from} — {stats.date_to}, "
                  f"дней {stats.days_loaded}, строк {stats.rows_loaded}",
                  flush=True)

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
