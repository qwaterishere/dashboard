from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.api.deps import CurrentUser, get_db
from src.schemas.sales import SalesPage
from src.services.sales import build_sales

router = APIRouter(tags=["Продажи"])


@router.get(
    "/api/sales",
    response_model=SalesPage,
    summary="Позиции за период: порции, цены, себестоимость",
)
def get_sales(
    _user: CurrentUser,
    db: Session = Depends(get_db),
    date_from: date | None = None,
    date_to: date | None = None,
) -> SalesPage:
    return build_sales(db, date_from, date_to)
