"""Internal endpoints for scheduler/worker (bearer token, no user session)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import Field
from slowapi import Limiter

from src.api.deps import verify_sync_scheduler_token
from src.core.config import get_settings
from src.schemas.base import StrictModel
from src.services.iiko_sync import process_queued_sync
from src.services.iiko_sync_scheduler import ScheduledSyncOutcome, enqueue_due_syncs


class InternalSyncRequest(StrictModel):
    restaurant_id: UUID | None = Field(
        default=None,
        description="Один ресторан; null — все настроенные iiko",
    )


class InternalSyncOutcomePublic(StrictModel):
    restaurant_id: UUID
    result: str
    detail: str | None = None


class InternalSyncResponse(StrictModel):
    outcomes: list[InternalSyncOutcomePublic]


def _to_public(outcome: ScheduledSyncOutcome) -> InternalSyncOutcomePublic:
    return InternalSyncOutcomePublic(
        restaurant_id=outcome.restaurant_id,
        result=outcome.result,
        detail=outcome.detail,
    )


def create_internal_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix="/api/internal", tags=["Internal"])
    settings = get_settings()

    @router.post(
        "/v1/sync/iiko",
        response_model=InternalSyncResponse,
        summary=(
            "Enqueue due incremental syncs (queued/skipped). "
            "Long work is performed by `python -m src.cli.sync_worker`."
        ),
        operation_id="triggerInternalIikoSync",
        dependencies=[Depends(verify_sync_scheduler_token)],
    )
    @limiter.limit(settings.rate_limit)
    def trigger_iiko_sync_v1(
        request: Request,
        payload: InternalSyncRequest,
    ) -> InternalSyncResponse:
        outcomes = enqueue_due_syncs(restaurant_id=payload.restaurant_id)
        # Dev DX only: optionally drain queue in-process when allowed.
        cfg = get_settings()
        if not cfg.is_production and cfg.sync_run_in_api:
            for item in outcomes:
                if item.result == "queued":
                    process_queued_sync(item.restaurant_id)
        return InternalSyncResponse(outcomes=[_to_public(item) for item in outcomes])

    return router
