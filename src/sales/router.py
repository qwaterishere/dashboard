"""HTTP-эндпоинты домена sales."""
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.sales.schemas import SalesPage
from src.sales.service import build_sales

router = APIRouter(tags=['Продажи'])


@router.get('/api/sales', response_model=SalesPage,
            summary='Позиции за период: порции, цены, себестоимость',
            response_description='Агрегат по блюдам; бесплатные порции '
                                 'исключены из qty и средних цен')
def get_sales(date_from: date | None = None,
              date_to: date | None = None,
              db: Session = Depends(get_db)) -> SalesPage:
    """Страница «Продажи» из БД. Без параметров — весь период в базе.

    Пример: /api/sales?date_from=2026-06-01&date_to=2026-06-30
    """
    return build_sales(db, date_from, date_to)
