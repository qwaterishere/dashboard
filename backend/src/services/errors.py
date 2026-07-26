"""Shared domain errors for service → HTTP mapping."""

from __future__ import annotations


class DomainError(Exception):
    """Typed service error; routes map via ``http_error(status, detail, code)``."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        code: str = "domain_error",
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.code = code
        super().__init__(detail)


class RestaurantError(DomainError):
    """Restaurant / iiko integration domain errors."""
