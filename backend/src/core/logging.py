"""Настройка логирования в stdout (текст или JSON)."""

from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone


class JsonLogFormatter(logging.Formatter):
    """Один JSON-объект на строку: time, level, logger, message, optional request_id."""

    def format(self, record: logging.LogRecord) -> str:
        from src.core.request_context import get_request_id

        payload: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: int = logging.INFO, *, log_json: bool | None = None) -> None:
    """Идемпотент: безопасно вызывать из create_app()."""
    root = logging.getLogger()
    if root.handlers:
        return

    if log_json is None:
        try:
            from src.core.config import get_settings

            log_json = bool(get_settings().log_json)
        except Exception:
            log_json = False

    handler = logging.StreamHandler(sys.stdout)
    if log_json:
        handler.setFormatter(JsonLogFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
        )
    root.addHandler(handler)
    root.setLevel(level)
