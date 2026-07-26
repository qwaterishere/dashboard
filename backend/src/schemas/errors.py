"""Unified API error envelope."""

from src.schemas.base import StrictModel


class ErrorBody(StrictModel):
    message: str
    code: str
    request_id: str | None = None
