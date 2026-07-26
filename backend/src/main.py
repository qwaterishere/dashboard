"""Сезоны — бэкенд дашборда (FastAPI)."""

from src.app import create_app
from src.core.paths import RESOURCE_PROBES

app = create_app()

__all__ = ["app", "RESOURCE_PROBES"]
