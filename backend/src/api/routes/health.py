from fastapi import APIRouter, Request
from pydantic import BaseModel
from slowapi import Limiter

from src.core.config import get_settings


class HealthResponse(BaseModel):
    status: str


def create_health_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Health"])
    settings = get_settings()

    @router.get("/health", response_model=HealthResponse, summary="Liveness probe")
    @limiter.limit(settings.rate_limit)
    def health(request: Request) -> HealthResponse:
        return HealthResponse(status="ok")

    return router
