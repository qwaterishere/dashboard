from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter

from src.api.deps import CurrentUser
from src.core.config import get_settings
from src.core.paths import STUB_PAGES
from src.services.stubs import load_validated


def create_stub_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(tags=["Заглушки"])
    settings = get_settings()

    @router.get("/api/{page}", summary="Мокап страницы (warehouse, foodcost)")
    @limiter.limit(settings.rate_limit)
    def get_stub_page(
        request: Request,
        page: str,
        _user: CurrentUser,
    ) -> JSONResponse:
        if page not in STUB_PAGES:
            raise HTTPException(status_code=404, detail="Not found")
        return JSONResponse(load_validated(page))

    return router
