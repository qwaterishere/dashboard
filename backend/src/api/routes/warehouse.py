"""Роутер страницы «Склад».

ЗАГЛУШКА (фаза 1, в разработке): возвращает фикстуру, пока не написан
сервис build_warehouse. Нужна, чтобы контракт Warehouse отрисовался
в Swagger и фронтендер видел форму ответа. Точки интеграции и deps —
как у боевых роутеров (dashboard/foodcost).
TODO(warehouse): заменить _FIXTURE на build_warehouse(db, restaurant.id, as_of).
"""
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.warehouse import Warehouse

_FIXTURE = Warehouse.model_validate({
    "asOf": "2026-07-14",
    "dataBounds": {
        "earliest": "2025-07-13",
        "latest": "2026-07-14",
        "availableDates": ["2025-07-13", "2026-07-13", "2026-07-14"],
    },
    "totals": [
        {"key": "k", "value": 138189269},
        {"key": "b", "value": 183589685},
        {"key": "w", "value": 0},
    ],
    "positions": [
        {"productId": "d21e8560-d277-4dfc-b9e7-10fecf759e33",
         "name": "Мясо Вырезка говяжья", "category": "Мясо",
         "store": "k", "qty": 21.1, "unit": "кг", "value": 5486000},
        {"productId": "3f691fa9-699f-49f6-9ab9-5c1db164ab9a",
         "name": "Кокосовое молоко", "category": "Бакалея",
         "store": "k", "qty": 12.0, "unit": "л", "value": 966000},
        # минусовая строка: в totals не входит, но в positions есть
        {"productId": "21fbb693-ad8c-0624-018d-5a87fdd50161",
         "name": "Лимон", "category": "Фрукты",
         "store": "b", "qty": -2.5, "unit": "кг", "value": -87500},
    ],
    "negativeStock": {"count": 1, "valueAbs": 87500},
    "dynamics": [
        {"date": "2026-07-13", "byStore": [
            {"key": "k", "value": 137000000},
            {"key": "b", "value": 182000000},
            {"key": "w", "value": 0}]},
        {"date": "2026-07-14", "byStore": [
            {"key": "k", "value": 138189269},
            {"key": "b", "value": 183589685},
            {"key": "w", "value": 0}]},
    ],
})


def create_warehouse_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Склад"])
    settings = get_settings()

    @router.get(
        "/api/warehouse",
        response_model=Warehouse,
        summary="Склад: слепок остатков на день + динамика (фаза 1, заглушка)",
    )
    @limiter.limit(settings.rate_limit)
    def get_warehouse(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        as_of: date | None = Query(
            default=None, alias="date",
            description="День слепка из dataBounds.availableDates; "
            "дефолт — latest",
        ),
    ) -> Warehouse:
        # TODO(warehouse): build_warehouse(db, restaurant.id, as_of)
        return _FIXTURE

    return router
