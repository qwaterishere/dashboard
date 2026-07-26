"""Базовые метрики заведения: одна метрика — одна ручка (/api/base-metrics/*).

Конвенция слоёв метрик: <домен>_metrics (появятся sales_metrics,
foodcost_metrics...). base — пять головных показателей: выручка, чеки,
гости, средний чек, средний чек на гостя.

Только факты из продаж: план сюда не подмешивается — план принадлежит
домену Целей (/api/targets).

Слой — детерминированный калькулятор: считает ровно по запрошенным датам,
ничего не усекая и не подменяя. Края истории данных клиент узнаёт ручкой
bounds и сам решает, какой период честно спрашивать. Следствие, о котором
надо помнить: запросишь период шире данных — получишь сумму по имеющейся
части без предупреждения;

Правила подсчёта — единые с dashboard (см. его docstring):
  - выручка = сумма фактических оплат по блюдам; фильтр «чек с оплатой»
    ей не нужен — бесплатные позиции прибавляют ноль;
  - чеки/гости — только чеки с выручкой (paid_total > 0): целиком
    бесплатные чеки (представительские, стафф) — не продажи;
  - никаких JOIN-агрегатов заказов с блюдами: чеки и гости считаются
    по orders отдельно, иначе суммы умножаются на число блюд.

Семантика пустоты:
  None -> «делить не на что» (метрики-дроби без чеков/гостей);
      0-> честный ноль (в диапазоне нет продаж).
"""
# TODO(review): докстринг обрывается на ';' («без предупреждения;») —
#   завершить предложение.
# TODO(review): «Правила подсчёта — единые с dashboard» — преувеличение
#   (avg null vs 0 в /api/dashboard; нет forecast). При переходе с /api/dashboard на REST канон = этот слой +
#   общий SQL-модуль.
# Исправление: переписать формулировку; правила paid_total / запрет JOIN
#   блюд×заказов оставить как единственный источник правды.
from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.db.models.sales import DishSale, Order
from src.services.period_compare import previous_period

# Метрики-дроби: значение периода = сумма числителя / сумма знаменателя.
# НЕ средняя дневных средних — та даёт слабым дням тот же вес, что сильным.
# TODO(review): PEP8 — пробел вокруг «=»: `_RATIO = {`.
_RATIO= {
    'avg-check': ('revenue', 'checks'),
    'avg-check-per-guest': ('revenue', 'guests'),
}


# --------------------------------------------------------------------------
# запросы: по одному на метрику
# --------------------------------------------------------------------------
# TODO(review): критично для идеала — SQL ниже дублирует dashboard._totals /
#   _daily / _data_bounds. До копирования паттерна на sales/foodcost вынести в
#   services/analytics/queries.py (period_totals, period_daily, data_bounds,
#   unit_sums) и импортировать оттуда. Иначе два источник правды.
# TODO(review): ключи _TOTAL_QUERY/_RATIO должны браться из schema.MetricName,
#   не дублироваться строками (риск рассинхрона enum ↔ service).

def _revenue_total(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> float:
# TODO(review): float(DECIMAL) для money — на 10/10 недопустимо.
#   Политика MUST: Decimal до сериализации или строка в JSON; тест на копейки.
# TODO(review): индекс (restaurant_id, day) — MUST в Alembic до нагрузки прода.
    value = session.query(
        func.coalesce(func.sum(DishSale.paid_sum), 0),
    ).join(Order).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).scalar()
    return float(value)


def _checks_total(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> int:
    value = session.query(func.count(Order.id)).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).scalar()
    return int(value)


def _guests_total(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> int:
    value = session.query(
        func.coalesce(func.sum(Order.guests_number), 0),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).scalar()
    return int(value)


def _revenue_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, float]:
    rows = session.query(
        Order.day, func.sum(DishSale.paid_sum),
        # TODO(review): нет coalesce на sum в daily (в total есть) —
        #   выровнять; при NOT NULL на paid_sum риск низкий, стиль важен.
    ).join(DishSale).filter(
        # TODO(review): направление JOIN (Order→DishSale) не совпадает с
        #   _revenue_total (DishSale→Order). Унифицировать; паритет
        #   total vs sum(daily) — обязательный тест.
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
    ).group_by(Order.day)
    return {day: float(value) for day, value in rows}


def _checks_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, int]:
    rows = session.query(
        Order.day, func.count(Order.id),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(Order.day)
    return {day: int(value) for day, value in rows}


def _guests_daily(
    session: Session, restaurant_id: UUID, d_from: date, d_to: date,
) -> dict[date, int]:
    rows = session.query(
        Order.day, func.sum(Order.guests_number),
    ).filter(
        Order.restaurant_id == restaurant_id,
        Order.day.between(d_from, d_to),
        Order.paid_total > 0,
    ).group_by(Order.day)
    # TODO(review): int(value or 0) vs coalesce в _guests_total — выровнять.
    return {day: int(value or 0) for day, value in rows}


# Реестры «имя метрики -> её запрос». Дроби собираются из базовых
# запросов числителя и знаменателя — своего SQL у них нет.
_TOTAL_QUERY = {
    'revenue': _revenue_total,
    'checks': _checks_total,
    'guests': _guests_total,
}
_DAILY_QUERY = {
    'revenue': _revenue_daily,
    'checks': _checks_daily,
    'guests': _guests_daily,
}


def _period_value(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> float | int | None:
    """Значение метрики за период: базовая — один запрос;
    дробь — два (знаменатель первым: он ноль — числитель не нужен)."""
    # TODO(review): неизвестный metric → KeyError (500), если вызвать service
    #   в обход роутера. Исправление: явная проверка / MetricName → ValueError.
    if metric in _RATIO:
        num, den = _RATIO[metric]
        # TODO(review): 2 SQL round-trip на ratio; lfl(avg) → до 4.
        # Исправление: period_totals() → {revenue, checks, guests};
        #   ratio в Python из одной строки totals.
        den_value = _TOTAL_QUERY[den](session, restaurant_id, d_from, d_to)
        if not den_value:
            return None
        num_value = _TOTAL_QUERY[num](session, restaurant_id, d_from, d_to)
        # TODO(review): MUST — round() на avg запрещён без явной политики в
        #   контракте; по умолчанию отдавать сырое float/Decimal, округление
        #   на клиенте.
        return round(num_value / den_value)
    value = _TOTAL_QUERY[metric](session, restaurant_id, d_from, d_to)
    # TODO(review): MUST — убрать round(revenue); ломает «сырые числа».
    return round(value) if metric == 'revenue' else value


# --------------------------------------------------------------------------
# ручки
# --------------------------------------------------------------------------

def metric_bounds(session: Session, restaurant_id: UUID) -> dict:
    """GET /api/base-metrics/bounds — края истории данных.

    Клиент сверяется с ними, чтобы не запрашивать периоды шире данных
    и не сравнивать с полупустой базой."""
    # TODO(review): возвращать MetricBounds (Pydantic), не голый dict —
    #   строгая граница service→router.
    earliest, latest = session.query(
        func.min(Order.day), func.max(Order.day),
    ).filter(Order.restaurant_id == restaurant_id).one()
    # TODO(review): это max(Order.day), не «закрытый день» из schema.
    # TODO(review): при выносе в queries.data_bounds — один код для dashboard
    #   и REST (MUST до паритета слоёв).
    return {'date_from': earliest, 'date_to': latest}


def metric_fact(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> dict:
    """GET /api/base-metrics/{metric} — факт ровно за запрошенный период."""
    # TODO(review): metric: str → MetricName; не принимать произвольные строки.
    # TODO(review): возвращать MetricFact, не dict; включить поле metric в теле ответа.
    # TODO(review): не валидирует d_from <= d_to — либо здесь, либо контракт
    #   «валидация только в router» задокументировать явно.
    return {
        'date_from': d_from,
        'date_to': d_to,
        'value': _period_value(session, restaurant_id, metric, d_from, d_to),
    }


def metric_lfl(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> dict:
    """GET /api/base-metrics/{metric}/lfl — факт против предшествующего периода
    той же формы (правило дат — period_compare.previous_period, единое
    с /api/dashboard и фудкостом). Дельту в % считает клиент из двух сырых значений.

    Слой НЕ проверяет, покрыта ли база данными: base_value за период
    до начала истории — честный ноль по запросу, а не «данных не было».
    Клиент, которому важно, сверяется с metric_bounds."""
    # TODO(review): переименовать в metric_compare; lfl — alias.
    # TODO(review): добавить опциональные base_from/base_to (кастомный compare
    #   как compareStart/End у /api/dashboard). По умолчанию — previous_period.
    # TODO(review): считать base_incomplete относительно data_bounds; отдать
    #   в ответ.
    # TODO(review): не вызывать metric_fact дважды для ratio —
    #   максимум 2× period_totals.
    # TODO(review): распаковка **fact хрупка при смене формы MetricFact —
    #   собирать модель явно.
    base_from, base_to = previous_period(d_from, d_to)
    fact = metric_fact(session, restaurant_id, metric, d_from, d_to)
    base = metric_fact(session, restaurant_id, metric, base_from, base_to)
    return {
        **fact,
        'base_date_from': base['date_from'],
        'base_date_to': base['date_to'],
        'base_value': base['value'],
    }


def metric_series(
    session: Session, restaurant_id: UUID, metric: str,
    d_from: date, d_to: date,
) -> dict:
    """GET /api/base-metrics/{metric}/series — ряд по дням для графика.

    Календарная сетка сплошная по всему запрошенному диапазону:
    день без продаж -> 0 (метрики-дроби -> None, делить не на что)."""
    # TODO(review): нет granularity=month — нужно для годового графика дашборда (помесячно).
    # TODO(review): возвращать MetricSeries, не dict; поле metric в теле ответа.
    # TODO(review): вложенные day_value замыкания усложняют тест —
    #   вынести чистые функции.
    if metric in _RATIO:
        num, den = _RATIO[metric]
        num_daily = _DAILY_QUERY[num](session, restaurant_id, d_from, d_to)
        den_daily = _DAILY_QUERY[den](session, restaurant_id, d_from, d_to)

        def day_value(day: date) -> int | None:
            den_v = den_daily.get(day, 0)
            # TODO(review): round() на дневном avg — та же потеря точности;
            #   тип возврата int | None при round(float) — сузить/документировать.
            return round(num_daily.get(day, 0.0) / den_v) if den_v else None
    else:
        daily = _DAILY_QUERY[metric](session, restaurant_id, d_from, d_to)

        def day_value(day: date) -> float | int:
            value = daily.get(day, 0)
            # TODO(review): убрать round(revenue) в series.
            return round(value) if metric == 'revenue' else value

    points = []
    day = d_from
    while day <= d_to:
        # TODO(review): заменить while на date_range helper (читаемость,
        #   меньше off-by-one риска).
        points.append({'date': day, 'value': day_value(day)})
        day += timedelta(days=1)
    # TODO(review): форматирование return в две строки / магический
    #   'granularity': 'day' — уйдёт, когда модель задаст default.
    return {'date_from': d_from, 'date_to': d_to,
            'granularity': 'day', 'points': points}


# ---------------------------------------------------------------------------
# TODO(review): сервис для Дашборда — MUST (не «желательно»):
#
# НОВЫЕ ФАЙЛЫ:
#   services/analytics/queries.py — period_totals/daily, data_bounds, unit_sums,
#     default_month_period
#   services/analytics/forecast.py — порт ForecastContext (без plan)
#
# ФУНКЦИИ ЗДЕСЬ: metric_default_period, metric_batch, metric_units,
#   metric_forecast, metric_compare, metric_series(..., granularity)
#
# РЕФАКТОР MUST:
#   - убрать ВСЕ round(revenue); avg — либо raw, либо явный quantize в контракте
#   - public API → только Pydantic; metric: MetricName; неизвестное → ValueError
#   - один реестр имён с schema.MetricName
#   - dashboard.py на analytics.queries; дубли SQL удалить
#   - Alembic: индекс (restaurant_id, day)
#   - деньги: не float на границе ответа
#
# ТЕСТЫ MUST до merge: tenant; avg null; no round revenue; series length;
#   fact год 200; batch ≤2 SQL; compare base_*; total==Σ(daily);
#   «не усекает даты» vs sales.
#
# НЕ СЮДА: targets / foodcost / warehouse / freshness / weekKpi на клиенте.
# ---------------------------------------------------------------------------
