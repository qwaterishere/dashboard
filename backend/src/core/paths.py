"""Filesystem paths for monorepo layout.

backend/     — Python API (this package)
"""

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent

# Все страницы с API-эндпоинтами (тесты, документация).
API_PAGES = frozenset({"dashboard", "sales", "foodcost", "targets", "warehouse"})
