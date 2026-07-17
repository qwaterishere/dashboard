"""Синк домена «склад»: ежедневные слепки остатков (карточка №13).

Правила:
- слепок = конец закрытого дня (23:59:59), пишется в stock_balances;
- только склады с каноническими именами Кухня/Бар/Вино
  (resolve_store_unit, паспорт §9) — остальные не синкаются;
- имена продуктов/категорий/единиц денормализуются на момент синка:
  история неизменна, идентичность — product_id;
- повторный синк дня перезаписывает его строки (replace, как продажи);
- ретеншн: дневные слепки — скользящий год; старше — только воскресенья
  (прореживание при каждом синке);
- инкремент: от последнего слепка вперёд; первый запуск — бэкфилл
  BACKFILL_DAYS дней.

Запуск — ТОЛЬКО CLI администратора и шедулер (решение 7 карточки №13):
пересинк прошлого переписывает зафиксированную историю (iiko считает
остатки из ТЕКУЩЕГО состояния документов) — потребителю недоступен.
Кнопка синка в UI на домен stock не распространяется; интеграция
в run_sync_job — отдельное согласование с коллегой (ветка шедулера).
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func

from src.db.models.restaurant import Restaurant
from src.db.models.warehouse import StockBalance, SyncDomainStatus
from src.db.session import db_manager
from src.domain.constants import resolve_store_unit
from src.integrations.iiko.client import IikoClient

logger = logging.getLogger(__name__)

DOMAIN = "stock"
BACKFILL_DAYS = 90
RETENTION_DAILY_DAYS = 365
SUNDAY = 6  # date.weekday(): 0=пн .. 6=вс


@dataclass(frozen=True)
class StockSyncStats:
    date_from: date | None
    date_to: date | None
    days_loaded: int
    rows_loaded: int


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _set_status(restaurant_id: uuid.UUID, **fields) -> None:
    """Upsert строки статуса домена (отдельная сессия — не мешает синку)."""
    session = db_manager.get_session()
    try:
        row = session.query(SyncDomainStatus).filter_by(
            restaurant_id=restaurant_id, domain=DOMAIN,
        ).first()
        if row is None:
            row = SyncDomainStatus(restaurant_id=restaurant_id, domain=DOMAIN)
            session.add(row)
        for key, value in fields.items():
            setattr(row, key, value)
        session.commit()
    finally:
        session.close()


def _resolve_plan(restaurant_id: uuid.UUID,
                  backfill_days: int) -> tuple[date, date] | None:
    """От последнего слепка вперёд; без слепков — бэкфилл; до вчера."""
    yesterday = date.today() - timedelta(days=1)
    session = db_manager.get_session()
    try:
        last = session.query(func.max(StockBalance.day)).filter(
            StockBalance.restaurant_id == restaurant_id,
        ).scalar()
    finally:
        session.close()

    date_from = (last + timedelta(days=1)) if last is not None \
        else yesterday - timedelta(days=backfill_days - 1)
    if date_from > yesterday:
        return None
    return date_from, yesterday


def _replace_day(restaurant_id: uuid.UUID, day: date,
                 rows: list[StockBalance]) -> None:
    """Идемпотентная запись дня: строки дня удаляются и вставляются заново."""
    session = db_manager.get_session()
    try:
        session.query(StockBalance).filter(
            StockBalance.restaurant_id == restaurant_id,
            StockBalance.day == day,
        ).delete(synchronize_session=False)
        session.add_all(rows)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _apply_retention(restaurant_id: uuid.UUID) -> int:
    """Старше скользящего года — оставить только воскресенья."""
    cutoff = date.today() - timedelta(days=RETENTION_DAILY_DAYS)
    session = db_manager.get_session()
    try:
        old_days = [d for (d,) in session.query(StockBalance.day).filter(
            StockBalance.restaurant_id == restaurant_id,
            StockBalance.day < cutoff,
        ).distinct() if d.weekday() != SUNDAY]
        if not old_days:
            return 0
        deleted = session.query(StockBalance).filter(
            StockBalance.restaurant_id == restaurant_id,
            StockBalance.day.in_(old_days),
        ).delete(synchronize_session=False)
        session.commit()
        return deleted
    finally:
        session.close()


def sync_restaurant_stock(restaurant: Restaurant, *,
                          backfill_days: int = BACKFILL_DAYS) -> StockSyncStats:
    """Синк слепков остатков одного ресторана (день-за-днём, коммит на день)."""
    if not restaurant.iiko_configured:
        raise RuntimeError("iiko is not configured")

    plan = _resolve_plan(restaurant.id, backfill_days)
    if plan is None:
        _set_status(restaurant.id, status="success", finished_at=_utc_now(),
                    error=None)
        return StockSyncStats(None, None, 0, 0)
    date_from, date_to = plan

    _set_status(restaurant.id, status="running", started_at=_utc_now(),
                finished_at=None, days_done=0, error=None)

    days_loaded = 0
    rows_loaded = 0
    try:
        with IikoClient(*restaurant.iiko_credentials()) as client:
            unit_by_store = {
                store_id: unit
                for store_id, name in client.fetch_stores()
                if (unit := resolve_store_unit(name)) is not None
            }
            if not unit_by_store:
                raise RuntimeError(
                    "no canonical stores (Кухня/Бар/Вино) — паспорт §9")

            units = client.fetch_measure_units()
            groups = client.fetch_product_groups()
            products = client.fetch_products_catalog()

            day = date_from
            while day <= date_to:
                balances = client.fetch_stock_balances(f"{day.isoformat()}T23:59:59")
                rows = []
                for item in balances:
                    unit = unit_by_store.get(item["store"])
                    if unit is None:
                        continue
                    pid = item["product"]
                    name, parent, main_unit = products.get(
                        pid, (pid, None, None))
                    rows.append(StockBalance(
                        restaurant_id=restaurant.id,
                        day=day,
                        store_id=uuid.UUID(item["store"]),
                        store_unit=unit,
                        product_id=uuid.UUID(pid),
                        product_name=name,
                        category=groups.get(parent, "(без папки)"),
                        unit_name=units.get(main_unit, ""),
                        qty=item.get("amount") or 0,
                        value=item.get("sum") or 0,
                    ))
                _replace_day(restaurant.id, day, rows)
                days_loaded += 1
                rows_loaded += len(rows)
                _set_status(restaurant.id, days_done=days_loaded, last_day=day)
                day += timedelta(days=1)

        removed = _apply_retention(restaurant.id)
        if removed:
            logger.info("stock retention restaurant=%s removed=%s rows",
                        restaurant.id, removed)

        _set_status(restaurant.id, status="success", finished_at=_utc_now(),
                    error=None)
        return StockSyncStats(date_from, date_to, days_loaded, rows_loaded)
    except Exception:
        logger.exception("stock sync failed restaurant=%s", restaurant.id)
        # generic-текст: без internals (стектрейс — в логах)
        _set_status(restaurant.id, status="error", finished_at=_utc_now(),
                    error="Failed to load stock from iiko")
        raise
