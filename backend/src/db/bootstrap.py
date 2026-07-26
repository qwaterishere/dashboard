"""Dev/CLI schema bootstrap — never mutates schema in production."""

from __future__ import annotations

import logging

from src.core.config import get_settings
from src.db.session import db_manager

logger = logging.getLogger(__name__)


def ensure_dev_schema() -> None:
    """Create/upgrade schema for local CLI tools and development only.

    Production must use ``alembic upgrade head``; the API lifespan already
    asserts the DB is at Alembic head.
    """
    settings = get_settings()
    if settings.is_production:
        logger.info("skipping create_all: APP_ENV=production expects Alembic migrations")
        return
    db_manager.create_all()
