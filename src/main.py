"""Сезоны — бэкенд дашборда (FastAPI).

Запуск из корня репозитория:
    pip install -r requirements/dev.txt
    uvicorn backend.app:app --reload --port 8000

API: http://localhost:8000/api/dashboard
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.core.security import ALLOWED_ORIGINS, ALLOWED_PAGES, RATE_LIMIT, RATE_LIMIT_ENABLED, STATIC_DIR
from backend.middleware.security_headers import SecurityHeadersMiddleware
from backend.services.pages import load_validated
from src.dashboard.router import router as dashboard_router
from src.database import db_manager
from src.sales.router import router as sales_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Сезоны — API дашборда",
    version="0.1.0",
    description=(
        "Аналитика продаж ресторана из iiko.\n\n"
        "Принцип контрактов: бэкенд отдаёт **факты** (числа, даты числами), "
        "представление (проценты, доли, валюта, падежи) — зона фронтенда. "
        "Семантика пустоты: `null` — данных/модуля ещё нет, `0` — честный "
        "ноль из данных. Подробности: docs/frontend-handoff.md."
    ),
    openapi_tags=[
        {"name": "Дашборд", "description": "Главная страница (контракт v2, реальные данные)"},
        {"name": "Продажи", "description": "Страница продаж (реальные данные)"},
        {"name": "Заглушки", "description": "Страницы, ещё не переведённые на БД: отдают мокапы data/*.json"},
    ],
)
limiter = Limiter(key_func=get_remote_address, enabled=RATE_LIMIT_ENABLED)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)

db_manager.create_all()

# Роутеры доменов — до catch-all /api/{page}; точный /api/sales побеждает.
app.include_router(sales_router)
app.include_router(dashboard_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        raise exc
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/{page}", tags=["Заглушки"],
         summary="Мокап страницы (warehouse, foodcost)")
@limiter.limit(RATE_LIMIT)
def get_page(request: Request, page: str) -> JSONResponse:
    """Данные одной страницы дашборда (strict Pydantic validation)."""
    if page not in ALLOWED_PAGES:
        raise HTTPException(status_code=404, detail="Not found")
    return JSONResponse(load_validated(page))


# Статику монтируем ПОСЛЕ маршрутов API. STATIC_DIR=frontend/dist в production (Фаза 8).
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

PAGES = ALLOWED_PAGES
