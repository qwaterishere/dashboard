"""Фоновый worker автосинхронизации iiko.

    python -m src.cli.sync_worker --once
    python -m src.cli.sync_worker --loop --interval 900
    python -m src.cli.sync_worker --once --restaurant-id <uuid>
"""
from __future__ import annotations

import argparse
import sys
import time
import uuid

from src.core.config import get_settings
from src.db.session import db_manager
from src.services.iiko_sync_scheduler import run_scheduled_syncs


def _run_once(restaurant_id: uuid.UUID | None) -> int:
    outcomes = run_scheduled_syncs(restaurant_id=restaurant_id)
    for item in outcomes:
        detail = f" ({item.detail})" if item.detail else ""
        print(f"{item.restaurant_id}: {item.result}{detail}", flush=True)
    return 0 if outcomes else 0


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Worker автосинхронизации iiko")
    parser.add_argument(
        "--once",
        action="store_true",
        help="один проход и выход (для cron)",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="бесконечный цикл с паузой",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=settings.sync_worker_interval_seconds,
        metavar="SEC",
        help="интервал между проходами в --loop",
    )
    parser.add_argument(
        "--restaurant-id",
        dest="restaurant_id",
        type=uuid.UUID,
        metavar="UUID",
        help="только один ресторан",
    )
    args = parser.parse_args()

    if not args.once and not args.loop:
        parser.error("укажите --once или --loop")

    db_manager.create_all()

    if args.once:
        raise SystemExit(_run_once(args.restaurant_id))

    interval = max(60, args.interval)
    print(f"sync worker loop started (interval={interval}s)", flush=True)
    while True:
        try:
            _run_once(args.restaurant_id)
        except KeyboardInterrupt:
            print("stopped", flush=True)
            raise SystemExit(0) from None
        except Exception as exc:
            print(f"worker tick failed: {exc}", file=sys.stderr, flush=True)
        time.sleep(interval)


if __name__ == "__main__":
    main()
