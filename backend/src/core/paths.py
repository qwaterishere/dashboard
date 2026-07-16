"""Filesystem paths for monorepo layout.

backend/     — Python API (this package)
"""

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

DATA = BACKEND_ROOT / "data"

# Страницы, которые ещё отдаются из data/*.json (до миграции на БД).
# warehouse пока стаб: v2-контракт готов (schemas/warehouse.py), но фронт
# (панель склада дашборда) ждёт старую форму — миграция после согласования.
STUB_PAGES = frozenset({"warehouse"})

# Все страницы с API-эндпоинтами (тесты, документация).
API_PAGES = frozenset({"dashboard", "sales", "foodcost", "targets", *STUB_PAGES})
