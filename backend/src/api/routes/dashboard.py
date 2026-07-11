from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.dashboard import Dashboard
from src.services.dashboard import build_dashboard
from src.services.dashboard_etag import compute_dashboard_etag


def create_dashboard_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Дашборд"])
    settings = get_settings()

    @router.get(
        "/api/dashboard",
        response_model=None,
        summary="Главная: KPI, LfL, график, юниты",
        responses={304: {"description": "Not Modified"}},
    )
    @limiter.limit(settings.rate_limit)
    def get_dashboard(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = Query(default=None, ge=2000, le=2100),
        month: int | None = Query(default=None, ge=1, le=12),
    ) -> Dashboard | Response:
        if month is not None and year is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="year is required when month is set",
            )

        etag = compute_dashboard_etag(db, restaurant.id, year=year, month=month)
        cache_headers = {
            "ETag": etag,
            "Cache-Control": "private, no-cache",
        }

        client_etag = request.headers.get("if-none-match")
        if client_etag and client_etag == etag:
            return Response(status_code=304, headers=cache_headers)

        try:
            payload = build_dashboard(db, restaurant.id, year=year, month=month)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        return JSONResponse(
            content=payload.model_dump(mode="json"),
            headers=cache_headers,
        )

    return router
