"""Роутер страницы «Склад» (контракт v2, карточка №13).

Живёт на /api/warehouse: legacy-стаб снесён вместе со стаб-механикой
(17.07.2026, коллега), фронт мигрировал на v2 — двухпроекционная
развязка больше не нужна (handoff §2).
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.warehouse import Warehouse
from src.services.warehouse import SnapshotNotFound, build_warehouse


def create_warehouse_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Склад"])
    settings = get_settings()

    @router.get(
        "/api/warehouse",
        response_model=Warehouse,
        summary="Склад: слепок остатков на день + динамика стоимости",
        description=(
            "Ежедневные слепки остатков из БД (конец закрытого дня), "
            "не живой iiko. Производные — зона фронтенда: цена = value/qty, "
            "доля склада = value/Σtotals, тренд — из dynamics.\n\n"
            "Правило «минус не в тотал»: totals и dynamics считают только "
            "положительные строки (qty > 0); positions содержит слепок "
            "целиком, включая минусовые (qty < 0) — их сводка в negativeStock.\n\n"
            "404: слепков нет вовсе (склад ещё не синковался) или ?date "
            "вне dataBounds.availableDates — корректный day-picker гасит "
            "такие даты сам."
        ),
        responses={404: {"description": "Нет слепка на запрошенную дату"}},
    )
    @limiter.limit(settings.rate_limit)
    def get_warehouse_snapshot(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        as_of: date | None = Query(
            default=None, alias="date",
            description="День слепка из dataBounds.availableDates; "
            "дефолт — latest",
        ),
        dyn_from: date | None = Query(
            default=None, alias="from",
            description="Начало окна графика dynamics; "
            "дефолт — 30 дней до asOf",
        ),
        dyn_to: date | None = Query(
            default=None, alias="to",
            description="Конец окна графика dynamics; дефолт — asOf",
        ),
    ) -> Warehouse:
        try:
            return build_warehouse(db, restaurant.id, on_date=as_of,
                                   dyn_from=dyn_from, dyn_to=dyn_to)
        except SnapshotNotFound as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(exc),
            ) from exc

    return router
