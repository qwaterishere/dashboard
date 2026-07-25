"""Контракт REST-слоя метрик (/api/metrics/*) — schemas к services/rest.

Поля ответов в snake_case — единый стиль с query-параметрами слоя
(date_from/date_to); страничные контракты (camelCase) не трогаем.
Производные — зона клиента: дельту lfl в % он считает сам
из value и base_value.
"""

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
    avg_check = 'avg-check'
    avg_check_per_guest = 'avg-check-per-guest'


class MetricBounds(StrictModel):
    """Края истории данных ресторана. Клиент сверяется с ними,
    чтобы не запрашивать периоды шире данных и не сравнивать
    с полупустой базой lfl."""

    date_from: date | None = Field(
        description="Первый день с данными; null — данных ещё нет"
    )
    date_to: date | None = Field(
        description="Последний закрытый день; null — данных ещё нет"
    )


class MetricFact(StrictModel):
    """Факт метрики ровно за запрошенный период (без усечения данными)."""

    date_from: date = Field(description="Начало периода — эхо запроса")
    date_to: date = Field(description="Конец периода — эхо запроса")
    value: float | None = Field(
        description="Значение за период. Суммовые метрики: 0 — в диапазоне "
        "нет продаж. Дроби (avg-*): null — делить не на что "
        "(нет чеков/гостей)"
    )


class MetricLfl(MetricFact):
    """Факт против предшествующего периода той же формы.

    Правило дат базы — period_compare.previous_period (единое с BFF):
    полный месяц -> предыдущий полный; 1..N числа -> те же числа
    прошлого месяца; произвольный диапазон -> блок той же длины
    накануне. Дельта = (value - base_value) / base_value — на клиенте.
    """

    base_date_from: date = Field(description="Начало базового периода")
    base_date_to: date = Field(description="Конец базового периода")
    base_value: float | None = Field(
        description="Значение за базовый период, правила как у value. "
        "Внимание: покрытие базы данными слой не проверяет — "
        "сверяйтесь с /api/metrics/bounds"
    )


class SeriesPoint(StrictModel):
    date: date
    value: float | None = Field(
        description="Значение дня; 0 — день без продаж (суммовые), "
        "null — делить не на что (дроби)"
    )


class MetricSeries(StrictModel):
    """Ряд по дням для графика: календарная сетка сплошная
    по всему запрошенному диапазону."""

    date_from: date = Field(description="Начало периода — эхо запроса")
    date_to: date = Field(description="Конец периода — эхо запроса")
    granularity: Literal['day'] = Field(
        description="Шаг ряда; пока только day"
    )
    points: list[SeriesPoint]
