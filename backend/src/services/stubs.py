"""Load and validate mock JSON payloads for stub pages."""

import json
import logging

from fastapi import HTTPException
from pydantic import ValidationError

from src.core.paths import DATA
from src.schemas.stubs.registry import validate_page

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
