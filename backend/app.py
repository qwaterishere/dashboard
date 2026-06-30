"""Сезоны — бэкенд дашборда (FastAPI).

Сейчас эндпоинты просто отдают файлы data/<страница>.json — это рабочая
заглушка, чтобы фронтенд завёлся с реальным API.

Запуск из папки sezony-dashboard:
    pip install -r backend/requirements.txt
    uvicorn backend.app:app --reload --port 8000
Откройте http://localhost:8000/  (FastAPI отдаёт и сайт, и API — CORS не нужен).
API: http://localhost:8000/api/dashboard
"""
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parent.parent      # папка sezony-dashboard
DATA = ROOT / "data"
PAGES = {"dashboard", "sales", "warehouse", "foodcost"}

app = FastAPI(title="Сезоны — API дашборда")

# CORS нужен только если фронтенд открыт с другого origin (другой порт/домен).
# При запуске через этот же uvicorn (вариант выше) он не задействуется.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def load(name: str) -> dict:
    path = DATA / f"{name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Нет данных для «{name}»")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/{page}")
def get_page(page: str):
    """Данные одной страницы дашборда.

    Чтобы перейти на реальные данные, замените `load(page)` на ветку с расчётом,
    например:
        if page == "sales":
            return JSONResponse(build_sales_from_db())
    Важно: вернуть ту же структуру, что в data/sales.json.
    """
    if page not in PAGES:
        raise HTTPException(status_code=404, detail=f"Неизвестная страница: {page}")
    return JSONResponse(load(page))


# Статику монтируем ПОСЛЕ маршрутов API, чтобы /api/* обрабатывался first.
# Отдаёт index.html, app/ (js, css) и data/ (фолбэк фронтенда).
app.mount("/", StaticFiles(directory=ROOT, html=True), name="static")
