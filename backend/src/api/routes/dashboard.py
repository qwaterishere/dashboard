from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.deps import get_db
from src.schemas.dashboard import Dashboard
from src.services.dashboard import build_dashboard

router = APIRouter(tags=["Дашборд"])


@router.get(
    "/api/dashboard",
    response_model=Dashboard,
    summary="Главная: KPI, LfL, график, юниты",
)
def get_dashboard(db: Session = Depends(get_db)) -> Dashboard:
    return build_dashboard(db)
