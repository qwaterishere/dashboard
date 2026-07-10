"""Application factory (12-factor V: build vs run, VII: port binding)."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from src.api.routes.auth import create_auth_router
from src.api.routes.dashboard import create_dashboard_router
from src.api.routes.health import create_health_router
from src.api.routes.sales import create_sales_router
from src.api.routes.stubs import create_stub_router
from src.core.config import get_settings
from src.core.logging import configure_logging
from src.db.session import db_manager
from src.middleware.security_headers import SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.jwt_secret_key.startswith("dev-only-change-me"):
        logger.warning(
            "JWT_SECRET_KEY is a development placeholder — set a strong secret in production",
        )
    db_manager.create_all()
    yield


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(
        title="Сезоны — API дашборда",
        version="0.1.0",
        description=(
            "Аналитика продаж ресторана из iiko.\n\n"
            "Контракты: бэкенд отдаёт факты, представление — зона фронтенда. "
            "docs/frontend-handoff.md"
        ),
        openapi_tags=[
            {"name": "Health", "description": "Liveness / load balancer probes"},
            {"name": "Авторизация", "description": "JWT: register, login, refresh, logout"},
            {"name": "Дашборд", "description": "Главная (v2, БД)"},
            {"name": "Продажи", "description": "Продажи (БД)"},
            {"name": "Заглушки", "description": "warehouse/foodcost из data/*.json"},
        ],
        lifespan=lifespan,
    )

    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[settings.rate_limit],
        enabled=settings.rate_limit_enabled,
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=True,
    )

    app.include_router(create_health_router(limiter))
    app.include_router(create_auth_router(limiter))
    app.include_router(create_sales_router(limiter))
    app.include_router(create_dashboard_router(limiter))
    app.include_router(create_stub_router(limiter))

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        if isinstance(exc, HTTPException):
            raise exc
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    return app
