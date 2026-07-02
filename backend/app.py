"""Точка входа для uvicorn (см. README): re-export из src.main."""

from src.main import PAGES, app

__all__ = ["app", "PAGES"]
