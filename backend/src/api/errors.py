"""Helpers for consistent HTTP error envelopes."""

from __future__ import annotations

from fastapi import HTTPException, Request

from src.core.request_context import get_request_id
from src.schemas.errors import ErrorBody


def _request_id(request: Request | None) -> str | None:
    if request is None:
        return get_request_id()
    return get_request_id() or getattr(request.state, "request_id", None)


def http_error(
    status_code: int,
    message: str,
    code: str,
    request: Request | None = None,
    *,
    headers: dict[str, str] | None = None,
) -> HTTPException:
    """Raise-ready HTTPException with ``detail`` always ErrorBody-shaped."""
    body = ErrorBody(
        message=message,
        code=code,
        request_id=_request_id(request),
    )
    return HTTPException(
        status_code=status_code,
        detail=body.model_dump(exclude_none=True),
        headers=headers,
    )


def normalize_error_detail(
    detail: object,
    *,
    request: Request | None = None,
) -> dict[str, str | None]:
    """Normalize FastAPI/Starlette ``detail`` into ErrorBody dict."""
    request_id = _request_id(request)
    if isinstance(detail, str):
        body: dict[str, str | None] = {
            "message": detail,
            "code": "http_error",
        }
        if request_id:
            body["request_id"] = request_id
        return body
    if isinstance(detail, dict) and "message" in detail and "code" in detail:
        body = {
            "message": str(detail["message"]),
            "code": str(detail["code"]),
        }
        rid = detail.get("request_id") or request_id
        if rid:
            body["request_id"] = str(rid)
        return body
    body = {
        "message": str(detail),
        "code": "http_error",
    }
    if request_id:
        body["request_id"] = request_id
    return body
