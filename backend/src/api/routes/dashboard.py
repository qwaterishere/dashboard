from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.dashboard import Dashboard
from src.services.dashboard import build_dashboard


def create_dashboard_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Дашборд"])
    settings = get_settings()

    @router.get(
        "/api/dashboard",
        response_model=Dashboard,
        summary="Главная: KPI, LfL, график, юниты",
    )
    @limiter.limit(settings.rate_limit)
    def get_dashboard(
        request: Request,
        _user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> Dashboard:
        return build_dashboard(db)

    return router
