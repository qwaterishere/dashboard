"""Синк домена «списания»: акты WRITEOFF из OLAP TRANSACTIONS.

Правила:
- строка = агрегат (день х счёт списания х продукт); тип потери и юнит —
  маркерный резолвер resolve_loss_account (стандарт именования счетов);
- инвентаризационные корректировки НЕ входят (другой тип транзакции);
- акты проводятся задним числом, поэтому штатный синк ВСЕГДА перечитывает
  окно последних RESYNC_DAYS дней; исторический бэкфилл — CLI диапазоном;
- запись — upsert по естественному ключу, а не replace: сохраняем
  first_seen_at (когда МЫ впервые увидели акт — прокси «когда внесли»,
  метрика дисциплины бухгалтерии). Изменение сумм трогает last_changed_at;
  строка, исчезнувшая из выгрузки (акт удалили), удаляется.

Стороны проводки WRITEOFF (двойная запись: минус со склада — плюс на счёт
потерь):
- плюс на счёте потерь -> обычная строка списания;
- минус на счёте-СКЛАДЕ (канонические имена Кухня/Бар/Вино) -> складская
  сторона, отбрасывается молча;
- минус на счёте ПОТЕРЬ -> СТОРНО (гашение акта обратной проводкой):
  ловим явно, пишем со storno=True для отображения, но читающая сторона
  в суммы категорий такие строки не включает.

Запуск:
- штатно — внутри run_sync_job после продаж/склада;
- CLI ``python -m src.cli.writeoffs_loader`` — ручной бэкфилл диапазона.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from src.db.models.restaurant import Restaurant
from src.db.models.warehouse import SyncDomainStatus
from src.db.models.writeoffs import WriteoffEntry
from src.db.session import db_manager
from src.domain.constants import STORE_UNIT_BY_NAME, resolve_loss_account
from src.integrations.iiko.client import IikoClient

logger = logging.getLogger(__name__)

DOMAIN = "writeoffs"
RESYNC_DAYS = 35          # окно ежедневной перечитки: акты вносят с опозданием
BACKFILL_DAYS = 90        # первый запуск без истории


@dataclass(frozen=True)
class WriteoffsSyncStats:
    date_from: date
    date_to: date
    rows_seen: int        # строк списаний в выгрузке (без складских сторон)
    storno_seen: int      # из них сторно (минус на счёте потерь)
    inserted: int
    updated: int
    deleted: int


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


def _fetch_window(
    client: IikoClient, date_from: date, date_to: date,
) -> dict[tuple[date, str, uuid.UUID], dict]:
    """Выгрузка окна одним OLAP-запросом -> {ключ: поля строки}.

    Транзакций WRITEOFF десятки в день — окно в 35 дней дешевле,
    чем 35 запросов по дню.
    """
    body = {
        "reportType": "TRANSACTIONS",
        "buildSummary": False,
        "groupByRowFields": ["DateTime.DateTyped", "Account.Name",
                             "Product.Id", "Product.Name"],
        "aggregateFields": ["Amount", "Sum.ResignedSum"],
        "filters": {
            "DateTime.Typed": {
                "filterType": "DateRange", "periodType": "CUSTOM",
                "from": date_from.isoformat(),
                "to": (date_to + timedelta(days=1)).isoformat(),
            },
            "TransactionType": {
                "filterType": "IncludeValues", "values": ["WRITEOFF"],
            },
        },
    }
    response = client._http.post(
        "resto/api/v2/reports/olap",
        params={"key": client._token}, json=body,
    )
    response.raise_for_status()

    entries: dict[tuple[date, str, uuid.UUID], dict] = {}
    for row in response.json()["data"]:
        account = (row.get("Account.Name") or "").strip()
        product_raw = row.get("Product.Id")
        total = Decimal(str(row.get("Sum.ResignedSum") or 0))

        if total <= 0 and account.lower() in STORE_UNIT_BY_NAME:
            continue                      # складская сторона проводки
        if not product_raw or not account:
            logger.warning("writeoff row without product/account skipped: %s",
                           row)
            continue

        storno = total < 0                # минус на счёте потерь = сторно
        if storno:
            logger.warning(
                "writeoff STORNO detected: day=%s account=%r product=%r "
                "sum=%s — записано с флагом, в суммах не участвует",
                row["DateTime.DateTyped"][:10], account,
                row.get("Product.Name"), total,
            )

        day = date.fromisoformat(row["DateTime.DateTyped"][:10])
        loss_type, unit = resolve_loss_account(account)
        key = (day, account, uuid.UUID(product_raw))
        entries[key] = {
            "loss_type": loss_type,
            "unit": unit,
            "product_name": (row.get("Product.Name") or "?").strip(),
            "amount": Decimal(str(row.get("Amount") or 0)),
            "sum": total,
            "storno": storno,
        }
    return entries


def _upsert_window(
    restaurant_id: uuid.UUID,
    date_from: date,
    date_to: date,
    fetched: dict[tuple[date, str, uuid.UUID], dict],
) -> tuple[int, int, int]:
    """Синхронизация окна: insert новых, update изменённых, delete исчезнувших.

    first_seen_at существующих строк НЕ трогается — в этом весь смысл
    upsert вместо replace."""
    session = db_manager.get_session()
    try:
        existing = {
            (row.day, row.account_name, row.product_id): row
            for row in session.query(WriteoffEntry).filter(
                WriteoffEntry.restaurant_id == restaurant_id,
                WriteoffEntry.day.between(date_from, date_to),
            )
        }

        # Guard: пустая выгрузка при непустом окне — почти наверняка сбой
        # iiko, а не «все акты удалили». Массовое удаление снесло бы
        # first_seen_at (метрику дисциплины) при ре-вставке следующим
        # синком — лучше упасть и оставить окно нетронутым.
        if not fetched and existing:
            raise RuntimeError(
                f"empty writeoffs fetch for non-empty window "
                f"{date_from}..{date_to} ({len(existing)} rows) — aborting",
            )

        inserted = updated = 0
        now = _utc_now().replace(tzinfo=None)

        for key, fields in fetched.items():
            row = existing.pop(key, None)
            if row is None:
                day, account, product_id = key
                session.add(WriteoffEntry(
                    restaurant_id=restaurant_id, day=day,
                    account_name=account, product_id=product_id,
                    first_seen_at=now, **fields,
                ))
                inserted += 1
                continue
            if (row.amount != fields["amount"] or row.sum != fields["sum"]
                    or row.loss_type != fields["loss_type"]
                    or row.storno != fields["storno"]):
                row.amount = fields["amount"]
                row.sum = fields["sum"]
                row.loss_type = fields["loss_type"]
                row.unit = fields["unit"]
                row.product_name = fields["product_name"]
                row.storno = fields["storno"]
                row.last_changed_at = now
                updated += 1

        deleted = 0
        for row in existing.values():     # были в БД, исчезли из выгрузки
            session.delete(row)
            deleted += 1

        session.commit()
        return inserted, updated, deleted
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def sync_restaurant_writeoffs(
    restaurant: Restaurant,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
) -> WriteoffsSyncStats:
    """Синк актов списания одного ресторана.

    Без дат — штатное окно [вчера-RESYNC_DAYS .. вчера]; первый запуск
    (таблица пуста) — BACKFILL_DAYS. Явные даты — ручной бэкфилл CLI."""
    if not restaurant.iiko_configured:
        raise RuntimeError("iiko is not configured")

    yesterday = date.today() - timedelta(days=1)
    if date_to is None:
        date_to = yesterday
    if date_from is None:
        session = db_manager.get_session()
        try:
            has_rows = session.query(WriteoffEntry.id).filter(
                WriteoffEntry.restaurant_id == restaurant.id,
            ).first() is not None
        finally:
            session.close()
        days = RESYNC_DAYS if has_rows else BACKFILL_DAYS
        date_from = date_to - timedelta(days=days - 1)
    if date_from > date_to:
        raise ValueError("date_from must be on or before date_to")

    _set_status(restaurant.id, status="running", started_at=_utc_now(),
                finished_at=None, days_done=0, error=None)
    try:
        with IikoClient(*restaurant.iiko_credentials()) as client:
            fetched = _fetch_window(client, date_from, date_to)
        inserted, updated, deleted = _upsert_window(
            restaurant.id, date_from, date_to, fetched,
        )
        storno_seen = sum(1 for f in fetched.values() if f["storno"])
        _set_status(restaurant.id, status="success", finished_at=_utc_now(),
                    last_day=date_to, days_done=(date_to - date_from).days + 1,
                    error=None)
        stats = WriteoffsSyncStats(
            date_from, date_to, len(fetched), storno_seen,
            inserted, updated, deleted,
        )
        logger.info("writeoffs sync restaurant=%s %s", restaurant.id, stats)
        return stats
    except Exception:
        logger.exception("writeoffs sync failed restaurant=%s", restaurant.id)
        _set_status(restaurant.id, status="error", finished_at=_utc_now(),
                    error="Failed to load writeoffs from iiko")
        raise
