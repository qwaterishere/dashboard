"""Security-related settings."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data"

ALLOWED_PAGES = frozenset({"dashboard", "sales", "warehouse", "foodcost"})

DEFAULT_CORS_ORIGINS = "http://localhost:4200,http://localhost:8000"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

RATE_LIMIT = os.getenv("RATE_LIMIT", "60/minute")
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"

STATIC_DIR = Path(os.getenv("STATIC_DIR", str(ROOT)))
