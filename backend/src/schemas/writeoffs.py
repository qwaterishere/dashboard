"""Контракт явного API списаний (/api/writeoffs/*).

Потребители: главная (status — свежесть внесения актов), настройки
(accounts — счета с категориями), отчёты/боты (categories), деталка
(entries). Правила слоя — как везде: сырые числа, производные на клиенте;
период старше данных -> null, а не нули; сторно в суммы не входит.
"""

from datetime import date, datetime

from pydantic import Field

from src.schemas.base import StrictModel


class WriteoffsSyncInfo(StrictModel):
    """Статус домена writeoffs из restaurant_sync_domains."""

    status: str | None = Field(
        description="idle | running | success | error; null — синк ещё "
        "не запускался"
    )
    last_day: date | None = Field(
        description="Последний день окна успешного синка"
    )
    finished_at: datetime | None = Field(
        description="Когда синк закончился (UTC)"
    )


class WriteoffsStatus(StrictModel):
    """GET /api/writeoffs/status — свежесть актов для главной.

    Разница двух дат — суть блока: last_act_day — какими датами
    ПОМЕЧЕНЫ акты, last_recorded_at — когда их физически ВНОСИЛИ
    (наше наблюдение first_seen_at, точность — сутки синка).
    """

    last_act_day: date | None = Field(
        description="Самая свежая дата акта в данных; null — актов нет"
    )
    last_recorded_at: datetime | None = Field(
        description="Когда бухгалтер последний раз вносил/менял акты "
        "(max first_seen/last_changed); null — актов нет"
    )
    recording_lag_days: float | None = Field(
        description="Средний лаг «дата акта -> внесение» в днях за "
        "последние 30 дней наблюдений; null — истории наблюдений "
        "меньше 14 дней (метрика копится с момента включения синка)"
    )
    sync: WriteoffsSyncInfo


class WriteoffAccount(StrictModel):
    """Счёт списания iiko глазами настроек: как категоризуется и сколько весит."""

    name: str = Field(description="Сырое имя счёта в iiko — как ведёт бухгалтер")
    loss_type: str = Field(
        description="Текущая категория (ключ); ярлыки — словарь фронта"
    )
    unit: str | None = Field(
        description="Юнит из имени счёта (k/b/w); null — без юнита"
    )
    source: str = Field(
        description="Как определена категория: marker (глобальные маркеры) | "
        "fallback (не распознан -> other, кандидат на настройку). "
        "mapping появится с ручной настройкой счетов"
    )
    sum90d: float = Field(description="Сумма списаний счёта за последние 90 дней")
    rows90d: int = Field(description="Строк-актов за 90 дней")
    last_act_day: date | None = Field(description="Последний акт по счёту")


class WriteoffAccounts(StrictModel):
    """GET /api/writeoffs/accounts — счета из фактических данных ресторана,
    по убыванию суммы. Основа страницы настроек категорий."""

    accounts: list[WriteoffAccount]


class WriteoffCategoryRow(StrictModel):
    key: str = Field(description="Ключ категории (ярлыки — словарь фронта)")
    sum: float = Field(description="Сумма за период")
    rows: int = Field(description="Строк-актов")


class WriteoffAccountRow(StrictModel):
    name: str = Field(description="Счёт как в iiko")
    loss_type: str = Field(description="Категория счёта")
    sum: float = Field(description="Сумма за период")
    rows: int = Field(description="Строк-актов")


class WriteoffCategories(StrictModel):
    """GET /api/writeoffs/categories — самостоятельный ресурс списаний
    за произвольный период (для отчётов/ботов; страница фудкоста берёт
    то же из своего снапшота). Разрезы: наши категории и счета iiko."""

    date_from: date = Field(description="Начало периода — эхо запроса")
    date_to: date = Field(description="Конец периода — эхо запроса")
    total: float = Field(description="Сумма всех категорий")
    categories: list[WriteoffCategoryRow] = Field(
        description="Ненулевые, по убыванию суммы"
    )
    accounts: list[WriteoffAccountRow] = Field(
        description="Разрез «как в iiko» — по сырым счетам"
    )
    stornoCount: int = Field(description="Отменённых проводок (в суммах их нет)")
    stornoSum: float = Field(description="Их суммарный минус")


class WriteoffEntryRow(StrictModel):
    day: date
    account: str = Field(description="Счёт как в iiko")
    loss_type: str = Field(description="Категория")
    unit: str | None = Field(description="Юнит счёта (k/b/w); null — без юнита")
    product: str = Field(description="Продукт/блюдо акта")
    amount: float = Field(description="Количество (ед. продукта)")
    sum: float = Field(description="Сумма списания")


class WriteoffEntries(StrictModel):
    """GET /api/writeoffs — деталка актов за период (фильтры loss_type,
    account). Сторно исключены."""

    date_from: date = Field(description="Начало периода — эхо запроса")
    date_to: date = Field(description="Конец периода — эхо запроса")
    entries: list[WriteoffEntryRow] = Field(
        description="По убыванию дня, затем суммы"
    )
