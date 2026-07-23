"""Лёгкие миграции схемы без Alembic (dev / первые prod-деплои).

create_all не меняет существующие таблицы — здесь добавляем колонки и индексы,
которые нужны для multi-tenant iiko.
"""

from __future__ import annotations

import logging

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

logger = logging.getLogger(__name__)


def _sqlite_rebuild_orders_with_restaurant(engine: Engine) -> None:
    """Пересоздаёт orders с restaurant_id и составным unique."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS orders_new (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    restaurant_id BLOB,
                    order_number INTEGER NOT NULL,
                    session_number INTEGER NOT NULL,
                    day DATE NOT NULL,
                    guests_number INTEGER NOT NULL,
                    paid_total DECIMAL(12, 4) NOT NULL,
                    pay_type VARCHAR,
                    pay_type_name VARCHAR,
                    order_type VARCHAR,
                    FOREIGN KEY(restaurant_id) REFERENCES restaurants (id)
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO orders_new (
                    id, restaurant_id, order_number, session_number, day,
                    guests_number, paid_total, pay_type, pay_type_name, order_type
                )
                SELECT
                    id, NULL, order_number, session_number, day,
                    guests_number, paid_total, pay_type, pay_type_name, order_type
                FROM orders
                """
            )
        )
        conn.execute(text("DROP TABLE orders"))
        conn.execute(text("ALTER TABLE orders_new RENAME TO orders"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_orders_id ON orders (id)"))
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_order_restaurant
                ON orders (restaurant_id, order_number, session_number, day)
                """
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_orders_restaurant_id ON orders (restaurant_id)")
        )
    logger.info("Migrated orders table: added restaurant_id")


_RESTAURANT_SYNC_COLUMNS: tuple[tuple[str, str], ...] = (
    ("sync_status", "VARCHAR(16) NOT NULL DEFAULT 'idle'"),
    ("sync_started_at", "TIMESTAMP"),
    ("last_sync_at", "TIMESTAMP"),
    ("last_sync_error", "VARCHAR(500)"),
    ("last_sync_from", "DATE"),
    ("last_sync_to", "DATE"),
    ("last_sync_days", "INTEGER"),
    ("sync_plan_from", "DATE"),
    ("sync_plan_to", "DATE"),
    ("sync_days_done", "INTEGER"),
    ("sync_current_day", "DATE"),
    ("timezone", "VARCHAR(64) NOT NULL DEFAULT 'Asia/Bishkek'"),
    ("auto_sync_enabled", "BOOLEAN NOT NULL DEFAULT TRUE"),
)


def _migrate_restaurant_sync_columns(engine: Engine) -> None:
    inspector = inspect(engine)
    if not inspector.has_table("restaurants"):
        return

    existing = {col["name"] for col in inspector.get_columns("restaurants")}
    for name, ddl in _RESTAURANT_SYNC_COLUMNS:
        if name in existing:
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE restaurants ADD COLUMN {name} {ddl}"))
        logger.info("Migrated restaurants table: added %s", name)


def _migrate_monthly_targets_locked(engine: Engine) -> None:
    inspector = inspect(engine)
    if not inspector.has_table("monthly_targets"):
        return
    existing = {col["name"] for col in inspector.get_columns("monthly_targets")}
    if "locked" in existing:
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE monthly_targets ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
    logger.info("Migrated monthly_targets table: added locked")


_MONTHLY_TARGETS_AMOUNT_COLUMNS: tuple[tuple[str, str], ...] = (
    ("compliments_goal_rub", "FLOAT NOT NULL DEFAULT 0"),
    ("compliments_mode", "VARCHAR(8) NOT NULL DEFAULT 'pct'"),
    ("inventory_goal_rub", "FLOAT NOT NULL DEFAULT 0"),
    ("inventory_mode", "VARCHAR(8) NOT NULL DEFAULT 'pct'"),
)


def _migrate_monthly_targets_amount_modes(engine: Engine) -> None:
    inspector = inspect(engine)
    if not inspector.has_table("monthly_targets"):
        return
    existing = {col["name"] for col in inspector.get_columns("monthly_targets")}
    for name, ddl in _MONTHLY_TARGETS_AMOUNT_COLUMNS:
        if name in existing:
            continue
        with engine.begin() as conn:
            conn.execute(text(f"ALTER TABLE monthly_targets ADD COLUMN {name} {ddl}"))
        logger.info("Migrated monthly_targets table: added %s", name)


def upgrade_schema(engine: Engine) -> None:
    from src.db.session import Base

    Base.metadata.create_all(engine)
    _migrate_restaurant_sync_columns(engine)
    _migrate_monthly_targets_locked(engine)
    _migrate_monthly_targets_amount_modes(engine)

    inspector = inspect(engine)
    if not inspector.has_table("orders"):
        return

    columns = {col["name"] for col in inspector.get_columns("orders")}
    if "restaurant_id" in columns:
        return

    url = str(engine.url)
    if url.startswith("sqlite"):
        _sqlite_rebuild_orders_with_restaurant(engine)
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE orders ADD COLUMN restaurant_id UUID "
                "REFERENCES restaurants(id)"
            )
        )
        conn.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_order_restaurant
                ON orders (restaurant_id, order_number, session_number, day)
                """
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_orders_restaurant_id ON orders (restaurant_id)")
        )
    logger.info("Migrated orders table: added restaurant_id (PostgreSQL)")
