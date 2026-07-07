"""Сезоны — бэкенд дашборда (FastAPI)."""

from src.app import create_app
from src.core.paths import API_PAGES

app = create_app()
PAGES = API_PAGES
