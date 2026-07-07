"""HTTP-эндпоинты домена dashboard (контракт v2)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.dashboard.schemas import Dashboard
from src.dashboard.service import build_dashboard
from src.database import get_db

router = APIRouter(tags=['Дашборд'])


@router.get('/api/dashboard', response_model=Dashboard,
            summary='Главная: KPI, LfL, график, юниты',
            response_description='Факты за месяц последнего закрытого дня '
                                 '+ тот же период прошлого года')
def get_dashboard(db: Session = Depends(get_db)) -> Dashboard:
    """Дашборд из БД (контракт v2). Период — месяц последнего закрытого дня.

    Регистрируется раньше catch-all /api/{page}, поэтому точный маршрут
    побеждает; мокап v1 удалён.
    """
    return build_dashboard(db)
