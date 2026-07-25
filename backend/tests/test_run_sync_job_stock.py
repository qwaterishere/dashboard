"""Интеграция склада в run_sync_job."""

from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock
from uuid import uuid4

from src.db.models.restaurant import Restaurant
from src.services import iiko_sync
from src.services.iiko_sync import SyncPlan, SyncStats
from src.services.warehouse_sync import StockSyncPlan, StockSyncStats


def test_run_sync_job_runs_stock_after_sales(monkeypatch):
    restaurant_id = uuid4()
    restaurant = Restaurant(
        id=restaurant_id,
        user_id=uuid4(),
        iiko_url="https://demo.iiko.it:443",
        iiko_login="api",
        iiko_password_encrypted="enc",
        sync_status="running",
    )

    session = MagicMock()
    session.get.return_value = restaurant
    monkeypatch.setattr(iiko_sync.db_manager, "get_session", lambda: session)

    monkeypatch.setattr(
        iiko_sync,
        "resolve_sync_plan",
        lambda *_a, **_k: SyncPlan(date(2026, 3, 1), date(2026, 3, 2)),
    )
    monkeypatch.setattr(
        "src.services.warehouse_sync.resolve_stock_plan",
        lambda *_a, **_k: StockSyncPlan(date(2026, 3, 1), date(2026, 3, 2)),
    )

    sales_calls: list[tuple] = []
    stock_calls: list = []

    def fake_sales(rest, d_from, d_to, **_kwargs):
        sales_calls.append((rest.id, d_from, d_to))
        return SyncStats(d_from, d_to, 2, 10)

    def fake_stock(rest, **kwargs):
        stock_calls.append(rest.id)
        assert kwargs.get("progress_hook") is not None
        return StockSyncStats(date(2026, 3, 1), date(2026, 3, 2), 2, 40)

    monkeypatch.setattr(iiko_sync, "sync_restaurant_sales", fake_sales)
    monkeypatch.setattr(
        "src.services.warehouse_sync.sync_restaurant_stock",
        fake_stock,
    )

    iiko_sync.run_sync_job(restaurant_id, full=False)

    assert len(sales_calls) == 1
    assert stock_calls == [restaurant_id]
    assert restaurant.sync_status == "success"
    session.commit.assert_called()


def test_run_sync_job_stock_failure_marks_error(monkeypatch):
    restaurant_id = uuid4()
    restaurant = Restaurant(
        id=restaurant_id,
        user_id=uuid4(),
        iiko_url="https://demo.iiko.it:443",
        iiko_login="api",
        iiko_password_encrypted="enc",
        sync_status="running",
    )

    session = MagicMock()
    session.get.return_value = restaurant
    monkeypatch.setattr(iiko_sync.db_manager, "get_session", lambda: session)

    monkeypatch.setattr(iiko_sync, "resolve_sync_plan", lambda *_a, **_k: None)
    monkeypatch.setattr(
        "src.services.warehouse_sync.resolve_stock_plan",
        lambda *_a, **_k: StockSyncPlan(date(2026, 3, 1), date(2026, 3, 1)),
    )
    monkeypatch.setattr(
        "src.services.warehouse_sync.sync_restaurant_stock",
        lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("iiko down")),
    )

    iiko_sync.run_sync_job(restaurant_id, full=False)

    assert restaurant.sync_status == "error"
    assert restaurant.last_sync_error == "Failed to load data from iiko"


def test_run_sync_job_noop_when_both_up_to_date(monkeypatch):
    restaurant_id = uuid4()
    restaurant = Restaurant(
        id=restaurant_id,
        user_id=uuid4(),
        iiko_url="https://demo.iiko.it:443",
        iiko_login="api",
        iiko_password_encrypted="enc",
        sync_status="running",
    )

    session = MagicMock()
    session.get.return_value = restaurant
    monkeypatch.setattr(iiko_sync.db_manager, "get_session", lambda: session)
    monkeypatch.setattr(iiko_sync, "resolve_sync_plan", lambda *_a, **_k: None)
    monkeypatch.setattr(
        "src.services.warehouse_sync.resolve_stock_plan",
        lambda *_a, **_k: None,
    )

    iiko_sync.run_sync_job(restaurant_id)

    assert restaurant.sync_status == "noop"
