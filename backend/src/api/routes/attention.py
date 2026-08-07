"""HTTP: GET /api/attention."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.attention import AttentionResponse
from src.services.attention import build_attention


def create_attention_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Ops"])
    settings = get_settings()

    @router.get(
        "/api/attention",
        response_model=AttentionResponse,
        operation_id="getAttention",
        summary="Операционный бриф: риски склада, фудкоста, темпа выручки, плана",
    )
    @limiter.limit(settings.rate_limit)
    def get_attention(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> AttentionResponse:
        return build_attention(db, restaurant)

    return router
