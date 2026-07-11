"""CLI-загрузчик продаж iiko в БД.

    python -m src.cli.sales_loader --restaurant-id <uuid>
    python -m src.cli.sales_loader --restaurant-id <uuid> --from 2025-03-01 --to 2025-03-31
"""
import argparse
import sys
import uuid
from datetime import date, timedelta

from src.db.models.restaurant import Restaurant
from src.db.session import db_manager
from src.services.iiko_sync import resolve_sync_plan, sync_restaurant_sales


def main() -> None:
    parser = argparse.ArgumentParser(description="Загрузка продаж iiko в БД дашборда")
    parser.add_argument(
        "--restaurant-id",
        dest="restaurant_id",
        type=uuid.UUID,
        required=True,
        metavar="UUID",
        help="ресторан пользователя (см. GET /api/auth/me/iiko после настройки)",
    )
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

    db_manager.create_all()

    session = db_manager.get_session()
    try:
        restaurant = session.get(Restaurant, args.restaurant_id)
        if restaurant is None:
            print(f"ресторан {args.restaurant_id} не найден", file=sys.stderr)
            raise SystemExit(1)

        plan = resolve_sync_plan(
            session,
            restaurant.id,
            date_from=args.date_from,
            date_to=args.date_to,
        )
    finally:
        session.close()

    if plan is None:
        print("нечего загружать: данные уже актуальны")
        return

    stats = sync_restaurant_sales(
        restaurant,
        plan.date_from,
        plan.date_to,
        chunk_days=max(1, args.chunk_days),
    )
    print(
        f"готово: {stats.date_from} — {stats.date_to}, "
        f"дней {stats.days_loaded}, строк OLAP {stats.rows_loaded}",
        flush=True,
    )


if __name__ == "__main__":
    main()
