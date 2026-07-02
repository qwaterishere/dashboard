"""Load and validate page JSON payloads."""

import json
import logging
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from backend.core.security import DATA
from backend.schemas.registry import validate_page

logger = logging.getLogger(__name__)


def load_raw(name: str) -> dict:
    path = DATA / f"{name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    return json.loads(path.read_text(encoding="utf-8"))


def load_validated(name: str) -> dict:
    raw = load_raw(name)
    try:
        model = validate_page(name, raw)
    except ValidationError as exc:
        logger.error("Schema validation failed for page %s: %s", name, exc)
        raise HTTPException(status_code=500, detail="Internal server error") from exc
    return model.model_dump(mode="json")
