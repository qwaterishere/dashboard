from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from slowapi import Limiter

from src.api.deps import CurrentRestaurant, CurrentUser, get_db
from src.core.config import get_settings
from src.schemas.writeoffs import (
    WriteoffAccounts,
    WriteoffCategories,
    WriteoffEntries,
    WriteoffsStatus,
)
from src.services.writeoffs_read import (
    build_writeoffs_accounts,
    build_writeoffs_categories,
    build_writeoffs_entries,
    build_writeoffs_status,
)

MAX_RANGE_DAYS = 366

_DATE_FROM = Query(description="Начало периода включительно (YYYY-MM-DD)")
_DATE_TO = Query(description="Конец периода включительно (YYYY-MM-DD)")


def _validate_range(date_from: date, date_to: date) -> None:
    if date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must be on or before date_to",
        )
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period is limited to {MAX_RANGE_DAYS} days",
        )


def create_writeoffs_router(limiter: Limiter) -> APIRouter:
    router = APIRouter(prefix="/api/writeoffs", tags=["Списания"])
    settings = get_settings()

    @router.get(
        "/status",
        response_model=WriteoffsStatus,
        operation_id="getWriteoffsStatus",
        summary="Свежесть внесения актов списания",
        description=(
            "Для главной/статус-строки: last_act_day — какими датами "
            "помечены акты; last_recorded_at — когда их физически вносили "
            "(наблюдение системы, точность — сутки синка); "
            "recording_lag_days — средний лаг внесения за 30 дней "
            "(null, пока наблюдений меньше 14 дней). "
            "Плюс статус ночного синка домена."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_status(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> WriteoffsStatus:
        return build_writeoffs_status(db, restaurant.id)

    @router.get(
        "/accounts",
        response_model=WriteoffAccounts,
        operation_id="getWriteoffsAccounts",
        summary="Счета списания и их категории",
        description=(
            "Счета из фактических актов ресторана за 90 дней, по убыванию "
            "суммы: имя как в iiko, текущая категория и способ её "
            "определения (marker/fallback), вес счёта. Основа страницы "
            "настроек категорий; source=fallback — счёт не распознан, "
            "кандидат на ручное назначение."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_accounts(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
    ) -> WriteoffAccounts:
        return build_writeoffs_accounts(db, restaurant.id)

    @router.get(
        "/categories",
        response_model=WriteoffCategories,
        operation_id="getWriteoffsCategories",
        summary="Списания за период: категории и счета",
        description=(
            "Самостоятельный ресурс для отчётов/ботов: суммы по нашим "
            "категориям и разрез «как в iiko» по сырым счетам. Страница "
            "фудкоста то же берёт из своего снапшота. Отменённые проводки "
            "в суммы не входят (stornoCount/stornoSum — сноска)."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_categories(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
    ) -> WriteoffCategories:
        _validate_range(date_from, date_to)
        return build_writeoffs_categories(db, restaurant.id,
                                          date_from, date_to)

    @router.get(
        "",
        response_model=WriteoffEntries,
        operation_id="getWriteoffsEntries",
        summary="Деталка актов списания",
        description=(
            "Строки актов (день х счёт х продукт) за период, по убыванию "
            "дня и суммы. Фильтры: loss_type (ключ категории), account "
            "(точное имя счёта iiko). Для разворотов «что именно списали» "
            "и ботов."
        ),
    )
    @limiter.limit(settings.rate_limit)
    def get_entries(
        request: Request,
        _user: CurrentUser,
        restaurant: CurrentRestaurant,
        db: Session = Depends(get_db),
        date_from: date = _DATE_FROM,
        date_to: date = _DATE_TO,
        loss_type: str | None = Query(
            default=None, description="Фильтр по ключу категории"),
        account: str | None = Query(
            default=None, description="Фильтр по имени счёта iiko"),
    ) -> WriteoffEntries:
        _validate_range(date_from, date_to)
        return build_writeoffs_entries(db, restaurant.id, date_from, date_to,
                                       loss_type=loss_type, account=account)

    return router
