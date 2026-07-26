"""Контракт REST-слоя метрик (/api/base-metrics/*) — schemas к services/rest.

Производные — зона клиента: дельту lfl в % он считает сам
из value и base_value.
"""
# TODO(review): в модульном докстринге зафиксировать канон REST vs старый /api/dashboard
#   (avg null ≠ avgCheck 0) и snake_case полей (намеренно, не camelCase
#   схем страницы в schemas/dashboard.py).

from datetime import date
from enum import Enum
from typing import Literal

from pydantic import Field

from src.schemas.base import StrictModel


class MetricName(str, Enum):
    """Метрики слоя. Базовые считаются одним SQL-запросом;
    avg-* — дроби из двух базовых (Σчислителя / Σзнаменателя)."""

    revenue = 'revenue'
    checks = 'checks'
    guests = 'guests'
    # TODO(review): значение path с дефисом (avg-check) — нормально для URL;
    #   в OpenAPI / генерации клиента явно задокументировать: клиенты шлют
    #   avg-check, не avg_check.
    avg_check = 'avg-check'
    avg_check_per_guest = 'avg-check-per-guest'
    # TODO(review): единый реестр имён метрик должен совпадать с ключами
    #   _TOTAL_QUERY / _RATIO в service (сейчас два источника правды).
    # Исправление: один Enum/константный модуль, service импортирует его.


class MetricBounds(StrictModel):
    """Края истории данных ресторана. Клиент сверяется с ними,
    чтобы не запрашивать периоды шире данных и не сравнивать
    с полупустой базой lfl."""

    # TODO(review): имя поля date_from в bounds конфликтует семантически с
    #   date_from запроса периода — в OpenAPI description подчеркнуть:
    #   «край истории», не «запрошенный период».
    date_from: date | None = Field(
        description="Первый день с данными; null — данных ещё нет"
    )
    date_to: date | None = Field(
        # TODO(review): description врёт — «Последний закрытый день».
        #   Реализация service = max(Order.day), не business closed-day /
        #   sync status.
        # Исправление: «Последний день с заказами в БД» ИЛИ отдельное поле
        #   closed_through из sync-status (семантики не смешивать).
        description="Последний закрытый день; null — данных ещё нет"
    )
    # TODO(review): нет json_schema_extra / examples для Swagger — добавить
    #   до передачи контракта фронту.


class MetricFact(StrictModel):
    """Факт метрики ровно за запрошенный период (без усечения данными)."""

    # TODO(review): нет поля-повтора metric в теле ответа: MetricName — клиент/логи/batch
    #   не видят метрику в теле.
    # Исправление: добавить metric: MetricName.
    date_from: date = Field(description="Начало периода — эхо запроса")
    date_to: date = Field(description="Конец периода — эхо запроса")
    value: float | None = Field(
        # TODO(review): value: float | None смешивает counts (checks/guests),
        #   money и ratio.
        # Исправление для prod-контракта:
        #   - отдельные модели по типу метрики (money|count|ratio) / union, ИЛИ
        #   - value: int | float | None + unit: Literal['money','count','ratio']
        #   Деньги на сервере не округлять (см. round() в service).
        description="Значение за период. Суммовые метрики: 0 — в диапазоне "
        "нет продаж. Дроби (avg-*): null — делить не на что "
        # TODO(review): null для avg — допустимый канон REST, но расходится
        #   со старым dashboard avgCheck=0. Зафиксировать решение короткой заметкой в репо (ADR); не обещать
        #   побитовое совпадение с /api/dashboard без явной миграции.
        "(нет чеков/гостей)"
    )
    # TODO(review): нет ограничений Field на согласованность
    #   date_from <= date_to (model_validator) — дублировать защиту схемы,
    #   не только роутера.


class MetricLfl(MetricFact):
    """Факт против предшествующего периода той же формы.

    Правило дат базы — period_compare.previous_period (единое с /api/dashboard):
    полный месяц -> предыдущий полный; 1..N числа -> те же числа
    прошлого месяца; произвольный диапазон -> блок той же длины
    накануне. Дельта = (value - base_value) / base_value — на клиенте.
    """
    # TODO(review): переименовать тип в MetricCompare (lfl — частный случай);
    #   оставить alias MetricLfl = MetricCompare на переходный период.
    # TODO(review): в докстринге формула дельты не оговаривает
    #   base_value in (null, 0) — клиенту нужна безопасная обработка в
    #   description / docs/frontend-handoff.md.

    base_date_from: date = Field(description="Начало базового периода")
    base_date_to: date = Field(description="Конец базового периода")
    base_value: float | None = Field(
        description="Значение за базовый период, правила как у value. "
        "Внимание: покрытие базы данными слой не проверяет — "
        "сверяйтесь с /api/base-metrics/bounds"
        # TODO(review): добавить base_incomplete: bool
        #   (base_from < bounds.date_from или bounds пуст) — иначе
        #   клиентская сборка Дашборда хрупка.
    )
    # TODO(review): model_validator: base_date_from <= base_date_to;
    #   при наличии поле metric в теле ответа — те же правила value, что у MetricFact.


class SeriesPoint(StrictModel):
    date: date
    # TODO(review): нет Field(description) на date — добавить для OpenAPI.
    value: float | None = Field(
        # TODO(review): та же проблема типа, что у MetricFact.value
        #   (count vs money vs ratio).
        description="Значение дня; 0 — день без продаж (суммовые), "
        "null — делить не на что (дроби)"
    )


class MetricSeries(StrictModel):
    """Ряд по дням для графика: календарная сетка сплошная
    по всему запрошенному диапазону."""

    # TODO(review): нет поля metric: MetricName в теле ответа — добавить.
    date_from: date = Field(description="Начало периода — эхо запроса")
    date_to: date = Field(description="Конец периода — эхо запроса")
    granularity: Literal['day'] = Field(
        # TODO(review): нет default='day' — сервис обязан всегда слать ключ.
        # Исправление: default='day'.
        # TODO(review): Literal['day'] мало для годового графика дашборда (помесячно) — расширить до
        #   Literal['day', 'month'] (или Enum) синхронно с service/router.
        description="Шаг ряда; пока только day"
    )
    points: list[SeriesPoint]
    # TODO(review): нет model_validator:
    #   при granularity=day → len(points) == (date_to - date_from).days + 1
    #   — ловит дыры сетки в CI.
    # TODO(review): для month — валидатор «точки = месяцы диапазона».


# ---------------------------------------------------------------------------
# TODO(review): схемы для Дашборда — MUST до cutover (не backlog):
#
# 1) DefaultPeriod
# 2) MetricBatchItem / MetricBatch (+ лимит числа items в описании)
# 3) UnitsResponse / UnitSums (k|b|w|o, revenue, cost, prev_*)
# 4) MetricForecast / ForecastPoint
# 5) MetricCompare (= MetricLfl) + base_incomplete: bool  [MUST]
# 6) SeriesGranularity day|month
# 7) Общий Period в schemas/base.py — шарить с sales/foodcost
# 8) Типы value: money|count|ratio (отдельные models или unit-поле)  [MUST]
# 9) examples / json_schema_extra на всех моделях слоя
# 10) Явно в Field: этот слой НЕ усекает даты (в отличие от /api/sales)
# 11) Политика денег: Decimal/str — не float  [MUST для 10/10]
# 12) snake_case vs camelCase dashboard — маппинг в docs/frontend-handoff.md
#
# Не копировать Kpis из schemas/dashboard.py (forecast внутри fact).
# ---------------------------------------------------------------------------
