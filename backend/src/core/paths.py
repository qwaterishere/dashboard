"""Filesystem paths for monorepo layout.

backend/     — Python API (this package)
"""

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

DATA = BACKEND_ROOT / "data"

# Страницы, которые ещё отдаются из data/*.json (до миграции на БД).
# warehouse временно на роутере-заглушке (контракт v2, фикстура) — стабов нет.
STUB_PAGES = frozenset()

# Все страницы с API-эндпоинтами (тесты, документация).
API_PAGES = frozenset({"dashboard", "sales", "foodcost", "warehouse"})
