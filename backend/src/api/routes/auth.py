"""Auth: register, login, refresh (rotation), logout, me."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from src.api.deps import CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from src.services.auth import (
    AuthError,
    login_user,
    logout_user,
    refresh_session,
    register_user,
    user_to_public,
)

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth"


def create_auth_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["Авторизация"])

    def _set_refresh_cookie(response: Response, raw_refresh: str) -> None:
        settings = get_settings()
        max_age = settings.jwt_refresh_token_expire_days * 24 * 60 * 60
        response.set_cookie(
            key=REFRESH_COOKIE,
            value=raw_refresh,
            httponly=True,
            secure=settings.jwt_cookie_secure,
            samesite="lax",
            path=REFRESH_COOKIE_PATH,
            max_age=max_age,
        )

    def _clear_refresh_cookie(response: Response) -> None:
        settings = get_settings()
        response.delete_cookie(
            key=REFRESH_COOKIE,
            path=REFRESH_COOKIE_PATH,
            httponly=True,
            secure=settings.jwt_cookie_secure,
            samesite="lax",
        )

    def _read_refresh_token(request: Request, body: RefreshRequest | None) -> str | None:
        if body and body.refresh_token:
            return body.refresh_token
        return request.cookies.get(REFRESH_COOKIE)

    def _unauthorized_refresh_response() -> JSONResponse:
        """401 + удаление битой cookie (raise HTTPException теряет Set-Cookie)."""
        payload = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid refresh token"},
        )
        _clear_refresh_cookie(payload)
        return payload

    @router.post(
        "/register",
        response_model=TokenResponse,
        status_code=status.HTTP_201_CREATED,
        summary="Регистрация",
    )
    @limiter.limit("5/minute")
    def register(
        request: Request,
        payload: RegisterRequest,
        response: Response,
        db: Session = Depends(get_db),
    ) -> TokenResponse:
        tokens, raw_refresh, _user = register_user(db, payload)
        _set_refresh_cookie(response, raw_refresh)
        return tokens

    @router.post(
        "/login",
        response_model=TokenResponse,
        summary="Вход по email и паролю",
    )
    @limiter.limit("10/minute")
    def login(
        request: Request,
        payload: LoginRequest,
        response: Response,
        db: Session = Depends(get_db),
    ) -> TokenResponse:
        tokens, raw_refresh, _user = login_user(db, payload.email, payload.password)
        _set_refresh_cookie(response, raw_refresh)
        return tokens

    @router.post(
        "/refresh",
        response_model=TokenResponse,
        summary="Обновление access token (refresh rotation)",
    )
    @limiter.limit("30/minute")
    def refresh(
        request: Request,
        response: Response,
        db: Session = Depends(get_db),
        body: RefreshRequest | None = None,
    ) -> TokenResponse | JSONResponse:
        raw = _read_refresh_token(request, body)
        if not raw:
            return _unauthorized_refresh_response()
        try:
            tokens, new_raw = refresh_session(db, raw)
        except AuthError:
            return _unauthorized_refresh_response()
        _set_refresh_cookie(response, new_raw)
        return tokens

    @router.post(
        "/logout",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Выход (revoke refresh token)",
    )
    def logout(
        request: Request,
        response: Response,
        db: Session = Depends(get_db),
        body: RefreshRequest | None = None,
    ) -> None:
        raw = _read_refresh_token(request, body)
        logout_user(db, raw)
        _clear_refresh_cookie(response)

    @router.get(
        "/me",
        response_model=UserPublic,
        summary="Текущий пользователь",
    )
    def me(user: CurrentUser) -> UserPublic:
        return user_to_public(user)

    return router
