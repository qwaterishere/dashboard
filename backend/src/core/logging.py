"""Настройка логирования в stdout"""

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    """Идeмпотент: безопасно вызывать из create_app()."""
    root = logging.getLogger()
    if root.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )
    root.addHandler(handler)
    root.setLevel(level)
