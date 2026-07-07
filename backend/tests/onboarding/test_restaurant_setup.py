"""Живые тесты соответствия iiko ресторана стандарту внедрения.

Запуск (против кассы из .env, ~1 минута):
    pytest -m onboarding

В обычный прогон (pytest) НЕ входят — ходят в живое API.
Каждый тест = раздел docs/iiko-setup-standard.md; красный тест — это
пункт работ для управляющего, а не баг кода. Ресторан подключается
к дашборду, когда все тесты зелёные.
"""
from datetime import date, timedelta

import pytest

from src.integrations.iiko.client import IikoClient
from src.integrations.iiko import audit

pytestmark = pytest.mark.onboarding


@pytest.fixture(scope='module')
def client():
    with IikoClient() as c:
        yield c


@pytest.fixture(scope='module')
def period():
    # последние 30 закрытых дней: [вчера-30, вчера) — правая граница
    # OLAP не включается, сегодняшняя незакрытая смена не попадает
    today = date.today()
    return today - timedelta(days=31), today


def _report(violations: list[str]) -> str:
    return 'нарушения стандарта:\n' + '\n'.join(f'  - {v}' for v in violations)


def test_nomenclature_tree(client, period):
    """Раздел 1: корневые группы номенклатуры — только Кухня/Бар/Вино."""
    violations = audit.check_nomenclature_tree(client, *period)
    assert not violations, _report(violations)


def test_order_types(client, period):
    """Раздел 2: типы заказов — стандартный набор, без пустых."""
    violations = audit.check_order_types(client, *period)
    assert not violations, _report(violations)


def test_deleted_share(client, period):
    """Чек-лист: доля удалённой выручки в норме (< 5%)."""
    violations = audit.check_deleted_share(client, *period)
    assert not violations, _report(violations)


def test_directory_hygiene(client, period):
    """Раздел 5: справочники без опечаток и групп-помоек."""
    violations = audit.check_directory_hygiene(client, *period)
    assert not violations, _report(violations)
