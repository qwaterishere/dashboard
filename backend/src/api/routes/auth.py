"""Auth: register, login, refresh (rotation), logout, me."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status
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
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserPublic,
)
from src.schemas.restaurant import (
    IikoSettingsPublic,
    IikoSyncStartResponse,
    UpdateIikoSettingsRequest,
)
from src.services.auth import (
    AuthError,
    change_user_password,
    login_user,
    logout_user,
    refresh_session,
    register_user,
    update_user_profile,
    user_to_public,
)
from src.services.restaurant import (
    get_or_create_restaurant,
    restaurant_to_iiko_public,
    schedule_iiko_sync,
    start_iiko_sync,
    update_iiko_settings,
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

    @router.patch(
        "/me",
        response_model=UserPublic,
        summary="Обновление профиля",
    )
    @limiter.limit("10/minute")
    def update_me(
        request: Request,
        payload: UpdateProfileRequest,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> UserPublic:
        assert_trusted_origin(request)
        return update_user_profile(db, user, payload)

    @router.post(
        "/change-password",
        response_model=TokenResponse,
        summary="Смена пароля (новая сессия)",
    )
    @limiter.limit("5/minute")
    def change_password(
        request: Request,
        payload: ChangePasswordRequest,
        response: Response,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> TokenResponse:
        assert_trusted_origin(request)
        tokens, raw_refresh, access_token = change_user_password(
            db,
            user,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
        _apply_session_cookies(
            response,
            access_token=access_token,
            expires_in=tokens.expires_in,
            raw_refresh=raw_refresh,
        )
        return tokens

    @router.get(
        "/me/iiko",
        response_model=IikoSettingsPublic,
        summary="Настройки подключения iiko",
    )
    @limiter.limit(settings.rate_limit)
    def get_iiko_settings(
        request: Request,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> IikoSettingsPublic:
        restaurant = get_or_create_restaurant(db, user)
        return restaurant_to_iiko_public(restaurant)

    @router.put(
        "/me/iiko",
        response_model=IikoSettingsPublic,
        summary="Сохранить подключение iiko",
    )
    @limiter.limit("5/minute")
    def save_iiko_settings(
        request: Request,
        payload: UpdateIikoSettingsRequest,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> IikoSettingsPublic:
        assert_trusted_origin(request)
        return update_iiko_settings(db, user, payload)

    @router.post(
        "/me/iiko/sync",
        response_model=IikoSyncStartResponse,
        status_code=status.HTTP_202_ACCEPTED,
        summary="Загрузить продажи из iiko (фоновая задача)",
    )
    @limiter.limit("3/minute")
    def sync_iiko_sales(
        request: Request,
        background_tasks: BackgroundTasks,
        user: CurrentUser,
        db: Session = Depends(get_db),
    ) -> IikoSyncStartResponse:
        assert_trusted_origin(request)
        restaurant = get_or_create_restaurant(db, user)
        response = start_iiko_sync(db, user)
        background_tasks.add_task(schedule_iiko_sync, restaurant.id)
        return response

    return router
