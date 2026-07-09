"""Tests for application settings."""

from src.core.config import resolve_sqlite_url
from src.core.paths import BACKEND_ROOT


def test_resolve_sqlite_url_makes_backend_relative_path_absolute():
    resolved = resolve_sqlite_url('sqlite:///dashboard.db')
    assert resolved == f'sqlite:///{(BACKEND_ROOT / "dashboard.db").resolve()}'


def test_resolve_sqlite_url_keeps_absolute_path():
    absolute = 'sqlite:////tmp/dashboard.db'
    assert resolve_sqlite_url(absolute) == absolute
