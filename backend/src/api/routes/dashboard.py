from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.deps import get_db
from src.schemas.dashboard import DashboardV2
from src.services.dashboard import build_dashboard

router = APIRouter(tags=["Дашборд"])


@router.get(
    "/api/dashboard",
    response_model=DashboardV2,
    summary="Главная: KPI, LfL, график, юниты",
)
def get_dashboard(db: Session = Depends(get_db)) -> DashboardV2:
    return build_dashboard(db)
