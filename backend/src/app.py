"""Application factory (12-factor V: build vs run, VII: port binding)."""

import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.routes.attention import create_attention_router
from src.api.routes.auth import create_auth_router
from src.api.routes.data_freshness import create_data_freshness_router
from src.api.routes.foodcost import create_foodcost_router
from src.api.routes.health import create_health_router
from src.api.routes.integrations import create_integrations_router
from src.api.routes.internal import create_internal_router
from src.api.routes.base_metrics import create_base_metrics_router
from src.api.routes.sales import create_sales_router
from src.api.routes.stock import create_stock_router
from src.api.routes.targets import create_targets_router
from src.core.config import get_settings
from src.core.logging import configure_logging
from src.core.request_context import get_request_id
from src.db.session import db_manager
from src.middleware.request_id import RequestIdMiddleware
from src.middleware.security_headers import SecurityHeadersMiddleware
from src.services.iiko_sync_scheduler import run_scheduled_syncs

logger = logging.getLogger(__name__)


def client_ip(request: Request) -> str:
    """Rate-limit key: trust X-Forwarded-For only when TRUSTED_PROXIES is set."""
    settings = get_settings()
    proxies_raw = (settings.trusted_proxies or "").strip()
    if not proxies_raw:
        return get_remote_address(request)

    proxies = {p.strip() for p in proxies_raw.split(",") if p.strip()}
    remote = get_remote_address(request)

    # "*" trusts XFF only in non-production (config gate forbids "*" in production)
    if "*" in proxies:
        if settings.is_production:
            if remote not in (proxies - {"*"}):
                return remote
        # non-prod: trust XFF
    elif remote not in proxies:
        return remote

    xff = request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    return remote


async def _embedded_sync_worker_loop(interval_seconds: int) -> None:
    while True:
        try:
            await asyncio.to_thread(run_scheduled_syncs)
        except Exception:
            logger.exception("embedded sync worker tick failed")
        await asyncio.sleep(interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.jwt_secret_key.startswith("dev-only-change-me"):
        logger.warning(
            "JWT_SECRET_KEY is a development placeholder — set a strong secret in production",
        )
    if settings.is_production and settings.rate_limit_storage_uri == "memory://":
        logger.warning(
            "RATE_LIMIT_STORAGE_URI=memory:// — rate limits are per-process only; "
            "use redis:// for multi-node production",
        )
    if not settings.is_production:
        db_manager.create_all()
    else:
        logger.info(
            "production startup: expecting Alembic-migrated schema (no create_all)",
        )
        _assert_alembic_at_head()

    worker_task: asyncio.Task[None] | None = None
    if settings.sync_embedded_worker:
        if settings.is_production:
            raise RuntimeError(
                "SYNC_EMBEDDED_WORKER is forbidden when APP_ENV=production; "
                "run `python -m src.cli.sync_worker` separately",
            )
        logger.info(
            "embedded iiko sync worker started (interval=%ss)",
            settings.sync_worker_interval_seconds,
        )
        worker_task = asyncio.create_task(
            _embedded_sync_worker_loop(settings.sync_worker_interval_seconds),
        )

    yield

    if worker_task is not None:
        worker_task.cancel()
        with suppress(asyncio.CancelledError):
            await worker_task


def _assert_alembic_at_head() -> None:
    """Fail closed if DB revision != Alembic head (production only)."""
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    from src.core.paths import BACKEND_ROOT

    cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
    cfg.set_main_option("sqlalchemy.url", get_settings().db_url or "")
    script = ScriptDirectory.from_config(cfg)
    head = script.get_current_head()
    with db_manager.engine.connect() as connection:
        context = MigrationContext.configure(connection)
        current = context.get_current_revision()
    if current != head:
        raise RuntimeError(
            f"Database revision {current!r} does not match Alembic head {head!r}; "
            "run `alembic upgrade head` before starting the API",
        )


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(log_json=bool(settings.log_json))

    app = FastAPI(
        title="Сезоны — API дашборда",
        version="1.0.0",
        description=(
            "Аналитика продаж ресторана из iiko.\n\n"
            "Контракты: бэкенд отдаёт факты, представление — зона фронтенда. "
            "Спецификация: docs/frontend-handoff.md"
        ),
        openapi_tags=[
            {"name": "Health", "description": "Liveness / load balancer probes"},
            {"name": "Авторизация", "description": "JWT, профиль, настройки iiko"},
            {"name": "Цели", "description": "Месячные планы и цели (БД)"},
            {"name": "Internal", "description": "Worker/cron (bearer token)"},
            {"name": "Продажи", "description": "Продажи (БД)"},
            {"name": "Склад", "description": "Остатки и динамика запасов (БД)"},
            {"name": "Фудкост", "description": "Фудкост (БД)"},
            {
                "name": "Базовые метрики (REST)",
                "description": "Головные показатели заведения: "
                "выручка, чеки, гости, средний чек (БД)",
            },
        ],
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    limiter = Limiter(
        key_func=client_ip,
        default_limits=[settings.rate_limit],
        enabled=settings.rate_limit_enabled,
        storage_uri=settings.rate_limit_storage_uri or "memory://",
    )
    app.state.limiter = limiter

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
        allow_credentials=True,
    )
    # Outermost: request id available for CORS / security handlers and app code
    app.add_middleware(RequestIdMiddleware)

    app.include_router(create_health_router(limiter))
    app.include_router(create_internal_router(limiter))
    app.include_router(create_auth_router(limiter))
    app.include_router(create_integrations_router(limiter))
    app.include_router(create_sales_router(limiter))
    app.include_router(create_stock_router(limiter))
    app.include_router(create_data_freshness_router(limiter))
    app.include_router(create_attention_router(limiter))
    app.include_router(create_targets_router(limiter))
    app.include_router(create_foodcost_router(limiter))
    app.include_router(create_base_metrics_router(limiter))

    def _error_request_id(request: Request) -> str | None:
        return get_request_id() or getattr(request.state, "request_id", None)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        message = "Validation error"
        if errors:
            message = str(errors[0].get("msg") or message)
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "message": message,
                    "code": "validation_error",
                    "request_id": _error_request_id(request),
                }
            },
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_exceeded_handler(
        request: Request, exc: RateLimitExceeded
    ) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content={
                "detail": {
                    "message": "Rate limit exceeded",
                    "code": "rate_limited",
                    "request_id": _error_request_id(request),
                }
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        from src.api.errors import normalize_error_detail

        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": normalize_error_detail(exc.detail, request=request)},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        request_id = _error_request_id(request)
        logger.exception("Unhandled error on %s", request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "detail": {
                    "message": "Internal server error",
                    "code": "internal_error",
                    "request_id": request_id,
                }
            },
        )

    return app
