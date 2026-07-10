"""Auth: register, login, refresh (rotation), logout, me."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from sqlalchemy.orm import Session

from src.api.cookies import (
    clear_access_cookie,
    clear_refresh_cookie,
    read_refresh_cookie,
    set_access_cookie,
    set_refresh_cookie,
)
from src.api.csrf import assert_trusted_origin
from src.api.deps import CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.auth import (
    LoginRequest,
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


def create_auth_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix="/api/auth", tags=["Авторизация"])
    settings = get_settings()

    def _unauthorized_refresh_response() -> JSONResponse:
        """401 + удаление битых cookies (raise HTTPException теряет Set-Cookie)."""
        payload = JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Invalid refresh token"},
        )
        clear_refresh_cookie(payload)
        clear_access_cookie(payload)
        return payload

    def _apply_session_cookies(
        response: Response,
        *,
        access_token: str,
        expires_in: int,
        raw_refresh: str,
    ) -> None:
        set_access_cookie(response, access_token, expires_in=expires_in)
        set_refresh_cookie(response, raw_refresh)

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
        assert_trusted_origin(request)
        tokens, raw_refresh, access_token, _user = register_user(db, payload)
        _apply_session_cookies(
            response,
            access_token=access_token,
            expires_in=tokens.expires_in,
            raw_refresh=raw_refresh,
        )
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
        assert_trusted_origin(request)
        tokens, raw_refresh, access_token, _user = login_user(db, payload.email, payload.password)
        _apply_session_cookies(
            response,
            access_token=access_token,
            expires_in=tokens.expires_in,
            raw_refresh=raw_refresh,
        )
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
    ) -> TokenResponse | JSONResponse:
        assert_trusted_origin(request)
        raw = read_refresh_cookie(request)
        if not raw:
            return _unauthorized_refresh_response()
        try:
            tokens, new_raw, access_token = refresh_session(db, raw)
        except AuthError:
            return _unauthorized_refresh_response()
        _apply_session_cookies(
            response,
            access_token=access_token,
            expires_in=tokens.expires_in,
            raw_refresh=new_raw,
        )
        return tokens

    @router.post(
        "/logout",
        status_code=status.HTTP_204_NO_CONTENT,
        summary="Выход (revoke refresh token)",
    )
    @limiter.limit("30/minute")
    def logout(
        request: Request,
        response: Response,
        db: Session = Depends(get_db),
    ) -> None:
        assert_trusted_origin(request)
        raw = read_refresh_cookie(request)
        logout_user(db, raw)
        clear_refresh_cookie(response)
        clear_access_cookie(response)

    @router.get(
        "/me",
        response_model=UserPublic,
        summary="Текущий пользователь",
    )
    @limiter.limit(settings.rate_limit)
    def me(request: Request, user: CurrentUser) -> UserPublic:
        return user_to_public(user)

    return router
