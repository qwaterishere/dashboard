from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.dashboard import Dashboard, DashboardChart, DashboardKpi, DataFreshness
from src.services.dashboard import build_dashboard, build_dashboard_chart, build_dashboard_kpi
from src.services.dashboard_etag import compute_dashboard_etag
from src.services.data_freshness import build_data_freshness


def _validate_dashboard_query(
    *,
    year: int | None,
    month: int | None,
    week_start: date | None,
    week_end: date | None,
    compare_start: date | None,
    compare_end: date | None,
) -> None:
    if month is not None and year is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="year is required when month is set",
        )
    if (week_start is None) ^ (week_end is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="weekStart and weekEnd must be provided together",
        )
    if week_start is not None and (year is None or month is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="year and month are required when weekStart/weekEnd are set",
        )
    if (compare_start is None) ^ (compare_end is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="compareStart and compareEnd must be provided together",
        )


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
        week_start: date | None = Query(default=None, alias="weekStart"),
        week_end: date | None = Query(default=None, alias="weekEnd"),
        compare_start: date | None = Query(default=None, alias="compareStart"),
        compare_end: date | None = Query(default=None, alias="compareEnd"),
    ) -> Dashboard | Response:
        _validate_dashboard_query(
            year=year,
            month=month,
            week_start=week_start,
            week_end=week_end,
            compare_start=compare_start,
            compare_end=compare_end,
        )

        etag = compute_dashboard_etag(
            db,
            restaurant.id,
            year=year,
            month=month,
            week_start=week_start,
            week_end=week_end,
            compare_start=compare_start,
            compare_end=compare_end,
        )
        cache_headers = {
            "ETag": etag,
            "Cache-Control": "private, no-cache",
        }

        client_etag = request.headers.get("if-none-match")
        if client_etag and client_etag == etag:
            return Response(status_code=304, headers=cache_headers)

        try:
            payload = build_dashboard(
                db,
                restaurant.id,
                year=year,
                month=month,
                week_start=week_start,
                week_end=week_end,
                compare_start=compare_start,
                compare_end=compare_end,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        return JSONResponse(
            content=payload.model_dump(mode="json"),
            headers=cache_headers,
        )

    @router.get(
        "/api/dashboard/chart",
        response_model=None,
        summary="Chart-слой дашборда (график и юниты без KPI)",
        responses={304: {"description": "Not Modified"}},
    )
    @limiter.limit(settings.rate_limit)
    def get_dashboard_chart(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = Query(default=None, ge=2000, le=2100),
        month: int | None = Query(default=None, ge=1, le=12),
        week_start: date | None = Query(default=None, alias="weekStart"),
        week_end: date | None = Query(default=None, alias="weekEnd"),
    ) -> DashboardChart | Response:
        _validate_dashboard_query(
            year=year,
            month=month,
            week_start=week_start,
            week_end=week_end,
            compare_start=None,
            compare_end=None,
        )

        etag = compute_dashboard_etag(
            db,
            restaurant.id,
            year=year,
            month=month,
            week_start=week_start,
            week_end=week_end,
            scope="chart",
        )
        cache_headers = {
            "ETag": etag,
            "Cache-Control": "private, no-cache",
        }

        client_etag = request.headers.get("if-none-match")
        if client_etag and client_etag == etag:
            return Response(status_code=304, headers=cache_headers)

        try:
            payload = build_dashboard_chart(
                db,
                restaurant.id,
                year=year,
                month=month,
                week_start=week_start,
                week_end=week_end,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        return JSONResponse(
            content=payload.model_dump(mode="json"),
            headers=cache_headers,
        )

    @router.get(
        "/api/dashboard/kpi",
        response_model=None,
        summary="KPI-слой дашборда (LfL overlay без графика)",
        responses={304: {"description": "Not Modified"}},
    )
    @limiter.limit(settings.rate_limit)
    def get_dashboard_kpi(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        year: int | None = Query(default=None, ge=2000, le=2100),
        month: int | None = Query(default=None, ge=1, le=12),
        week_start: date | None = Query(default=None, alias="weekStart"),
        week_end: date | None = Query(default=None, alias="weekEnd"),
        compare_start: date | None = Query(default=None, alias="compareStart"),
        compare_end: date | None = Query(default=None, alias="compareEnd"),
    ) -> DashboardKpi | Response:
        _validate_dashboard_query(
            year=year,
            month=month,
            week_start=week_start,
            week_end=week_end,
            compare_start=compare_start,
            compare_end=compare_end,
        )

        etag = compute_dashboard_etag(
            db,
            restaurant.id,
            year=year,
            month=month,
            week_start=week_start,
            week_end=week_end,
            compare_start=compare_start,
            compare_end=compare_end,
            scope="kpi",
        )
        cache_headers = {
            "ETag": etag,
            "Cache-Control": "private, no-cache",
        }

        client_etag = request.headers.get("if-none-match")
        if client_etag and client_etag == etag:
            return Response(status_code=304, headers=cache_headers)

        try:
            payload = build_dashboard_kpi(
                db,
                restaurant.id,
                year=year,
                month=month,
                week_start=week_start,
                week_end=week_end,
                compare_start=compare_start,
                compare_end=compare_end,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            ) from exc

        return JSONResponse(
            content=payload.model_dump(mode="json"),
            headers=cache_headers,
        )

    @router.get(
        "/api/data-freshness",
        response_model=DataFreshness,
        summary="Актуальность продаж в БД относительно закрытого дня",
    )
    @limiter.limit(settings.rate_limit)
    def get_data_freshness(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> DataFreshness:
        return build_data_freshness(db, restaurant)

    return router
