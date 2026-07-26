import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from slowapi import Limiter

from src.db.session import db_manager

logger = logging.getLogger(__name__)


class HealthResponse(BaseModel):
    status: str


class ReadyResponse(BaseModel):
    status: str
    detail: str | None = None


def create_health_router(_limiter: Limiter) -> APIRouter:
    # Health/ready probes are exempt from rate limiting (no @limiter.limit).
    router = APIRouter(tags=["Health"])

    @router.get(
        "/health",
        response_model=HealthResponse,
        summary="Liveness probe",
        operation_id="health",
    )
    def health(_request: Request) -> HealthResponse:
        return HealthResponse(status="ok")

    @router.get(
        "/api/health",
        response_model=HealthResponse,
        summary="Liveness probe (API)",
        operation_id="apiHealth",
    )
    def api_health(_request: Request) -> HealthResponse:
        return HealthResponse(status="ok")

    @router.get(
        "/api/ready",
        response_model=ReadyResponse,
        response_model_exclude_none=True,
        summary="Readiness probe (database)",
        operation_id="ready",
        responses={503: {"model": ReadyResponse}},
    )
    def ready(_request: Request) -> ReadyResponse | JSONResponse:
        try:
            with db_manager.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:
            logger.exception("readiness probe: database unavailable")
            return JSONResponse(
                status_code=503,
                content={"status": "not_ready", "detail": "database unavailable"},
            )
        return ReadyResponse(status="ready")

    return router
