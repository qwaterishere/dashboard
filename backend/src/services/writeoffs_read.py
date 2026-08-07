"""Чтение домена списаний для явного API (/api/writeoffs/*).

Синк (writeoffs_sync) пишет, этот модуль только читает. Первая ручка —
status: свежесть внесения актов для главной. Ключевая пара дат:
last_act_day — какими датами ПОМЕЧЕНЫ акты (операционная дата документа),
last_recorded_at — когда их физически ВНОСИЛИ (наше наблюдение
first_seen_at/last_changed_at, точность — сутки синка).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.warehouse import SyncDomainStatus
from src.db.models.writeoffs import WriteoffEntry

# Лаг внесения считаем только по накопленным наблюдениям: раньше этого
# срока first_seen_at ещё не отражает работу бухгалтера (первый бэкфилл
# помечает всю историю одной датой).
LAG_MIN_HISTORY_DAYS = 14
LAG_WINDOW_DAYS = 30


def build_writeoffs_status(session: Session, restaurant_id: uuid.UUID) -> dict:
    """GET /api/writeoffs/status."""
    last_act_day = session.query(func.max(WriteoffEntry.day)).filter(
        WriteoffEntry.restaurant_id == restaurant_id,
    ).scalar()

    last_recorded_at = session.query(
        func.max(func.coalesce(WriteoffEntry.last_changed_at,
                               WriteoffEntry.first_seen_at)),
    ).filter(WriteoffEntry.restaurant_id == restaurant_id).scalar()

    # средний лаг «дата акта -> внесение» по окну наблюдений
    recording_lag_days = None
    first_seen_min = session.query(func.min(WriteoffEntry.first_seen_at)).filter(
        WriteoffEntry.restaurant_id == restaurant_id,
    ).scalar()
    now = datetime.now(UTC).replace(tzinfo=None)
    if (first_seen_min is not None
            and now - first_seen_min >= timedelta(days=LAG_MIN_HISTORY_DAYS)):
        # без бэкфилл-строк: они помечены датой первого синка и лаг не отражают
        backfill_cutoff = first_seen_min + timedelta(days=1)
        window_from = now - timedelta(days=LAG_WINDOW_DAYS)
        rows = session.query(
            WriteoffEntry.day, WriteoffEntry.first_seen_at,
        ).filter(
            WriteoffEntry.restaurant_id == restaurant_id,
            WriteoffEntry.first_seen_at >= max(backfill_cutoff, window_from),
        ).all()
        lags = [
            (seen.date() - day).days
            for day, seen in rows
            if seen is not None and (seen.date() - day).days >= 0
        ]
        if lags:
            recording_lag_days = round(sum(lags) / len(lags), 1)

    sync_row = session.query(SyncDomainStatus).filter_by(
        restaurant_id=restaurant_id, domain="writeoffs",
    ).first()
    sync = {
        "status": sync_row.status if sync_row else None,
        "last_day": sync_row.last_day if sync_row else None,
        "finished_at": sync_row.finished_at if sync_row else None,
    }

    return {
        "last_act_day": last_act_day,
        "last_recorded_at": last_recorded_at,
        "recording_lag_days": recording_lag_days,
        "sync": sync,
    }


def build_writeoffs_accounts(session: Session,
                             restaurant_id: uuid.UUID) -> dict:
    """GET /api/writeoffs/accounts — счета с весами за 90 дней.

    Категория/юнит берутся из ДАННЫХ (loss_type строк, записанный синком),
    а не пересчитываются на лету: что записано, то пользователь и видит.
    source: fallback = other (кандидат на настройку), иначе marker;
    mapping появится вместе с restaurant_loss_accounts."""
    from datetime import date, timedelta as td

    window_from = date.today() - td(days=90)
    rows = session.query(
        WriteoffEntry.account_name,
        WriteoffEntry.loss_type,
        WriteoffEntry.unit,
        func.sum(WriteoffEntry.sum),
        func.count(WriteoffEntry.id),
        func.max(WriteoffEntry.day),
    ).filter(
        WriteoffEntry.restaurant_id == restaurant_id,
        WriteoffEntry.day >= window_from,
        WriteoffEntry.storno.is_(False),
    ).group_by(
        WriteoffEntry.account_name, WriteoffEntry.loss_type,
        WriteoffEntry.unit,
    ).all()

    accounts = [
        {
            "name": name,
            "loss_type": loss_type,
            "unit": unit,
            "source": "fallback" if loss_type == "other" else "marker",
            "sum90d": float(total),
            "rows90d": int(cnt),
            "last_act_day": last_day,
        }
        for name, loss_type, unit, total, cnt, last_day in rows
    ]
    accounts.sort(key=lambda a: -a["sum90d"])
    return {"accounts": accounts}


def build_writeoffs_categories(session: Session, restaurant_id: uuid.UUID,
                               d_from, d_to) -> dict:
    """GET /api/writeoffs/categories — категории + счета за период."""
    base = (WriteoffEntry.restaurant_id == restaurant_id,
            WriteoffEntry.day.between(d_from, d_to))

    cat_rows = session.query(
        WriteoffEntry.loss_type, func.sum(WriteoffEntry.sum),
        func.count(WriteoffEntry.id),
    ).filter(*base, WriteoffEntry.storno.is_(False)).group_by(
        WriteoffEntry.loss_type).all()
    categories = sorted(
        ({"key": lt, "sum": float(sm), "rows": int(cnt)}
         for lt, sm, cnt in cat_rows),
        key=lambda c: -c["sum"],
    )

    acc_rows = session.query(
        WriteoffEntry.account_name, WriteoffEntry.loss_type,
        func.sum(WriteoffEntry.sum), func.count(WriteoffEntry.id),
    ).filter(*base, WriteoffEntry.storno.is_(False)).group_by(
        WriteoffEntry.account_name, WriteoffEntry.loss_type).all()
    accounts = sorted(
        ({"name": name, "loss_type": lt, "sum": float(sm), "rows": int(cnt)}
         for name, lt, sm, cnt in acc_rows),
        key=lambda a: -a["sum"],
    )

    storno_cnt, storno_sum = session.query(
        func.count(WriteoffEntry.id),
        func.coalesce(func.sum(WriteoffEntry.sum), 0),
    ).filter(*base, WriteoffEntry.storno.is_(True)).one()

    return {
        "date_from": d_from, "date_to": d_to,
        "total": sum(c["sum"] for c in categories),
        "categories": categories,
        "accounts": accounts,
        "stornoCount": int(storno_cnt),
        "stornoSum": float(storno_sum),
    }


def build_writeoffs_entries(session: Session, restaurant_id: uuid.UUID,
                            d_from, d_to, *, loss_type: str | None = None,
                            account: str | None = None) -> dict:
    """GET /api/writeoffs — деталка актов (день х счёт х продукт)."""
    query = session.query(WriteoffEntry).filter(
        WriteoffEntry.restaurant_id == restaurant_id,
        WriteoffEntry.day.between(d_from, d_to),
        WriteoffEntry.storno.is_(False),
        # нулевые строки (бесплатные модификаторы «без газа» и т.п.) —
        # шум в деталке, в суммах их и так нет
        WriteoffEntry.sum > 0,
    )
    if loss_type is not None:
        query = query.filter(WriteoffEntry.loss_type == loss_type)
    if account is not None:
        query = query.filter(WriteoffEntry.account_name == account)

    entries = [
        {
            "day": row.day,
            "account": row.account_name,
            "loss_type": row.loss_type,
            "unit": row.unit,
            "product": row.product_name,
            "amount": float(row.amount),
            "sum": float(row.sum),
        }
        for row in query.all()
    ]
    entries.sort(key=lambda e: (e["day"], e["sum"]), reverse=True)
    return {"date_from": d_from, "date_to": d_to, "entries": entries}
