"""Аудит соответствия iiko ресторана стандарту внедрения.

Каждая проверка соответствует разделу docs/iiko-setup-standard.md
и возвращает список нарушений (пустой список = стандарт соблюдён).
Запускаются против живого iiko через tests/onboarding/
(pytest -m onboarding) перед подключением нового ресторана.
"""
from datetime import date

from src.domain.constants import CAT_OTHER, STANDARD_UNITS, resolve_unit
from src.integrations.iiko.client import IikoClient

# Раздел 2 паспорта: допустимые типы заказов.
STANDARD_ORDER_TYPES = {'Обычный заказ', 'Конференции', 'Бар', 'Завтраки'}
# Раздел 5: допустимая доля выручки удалённых заказов/блюд.
DELETED_SHARE_LIMIT = 0.05

_CLEAN_FILTERS = {
    'DeletedWithWriteoff': {'filterType': 'IncludeValues', 'values': ['NOT_DELETED']},
    'OrderDeleted': {'filterType': 'IncludeValues', 'values': ['NOT_DELETED']},
    'Storned': {'filterType': 'IncludeValues', 'values': ['FALSE']},
}


def _olap(client: IikoClient, group_by: list[str], aggregates: list[str],
          date_from: date, date_to: date, clean: bool = True) -> list[dict]:
    body = {
        'reportType': 'SALES',
        'buildSummary': False,
        'groupByRowFields': group_by,
        'aggregateFields': aggregates,
        'filters': {
            'OpenDate.Typed': {
                'filterType': 'DateRange', 'periodType': 'CUSTOM',
                'from': date_from.isoformat(), 'to': date_to.isoformat(),
            },
            **(_CLEAN_FILTERS if clean else {}),
        },
    }
    response = client._http.post('resto/api/v2/reports/olap',
                                 params={'key': client._token}, json=body)
    response.raise_for_status()
    return response.json()['data']


def check_nomenclature_tree(client, date_from, date_to) -> list[str]:
    """Раздел 1: корневые папки Кухня/Бар/Вино существуют и несут основное меню.

    Группы ВНЕ папок — не нарушение (выбор ресторана): они не попадают
    в разрезы по юнитам, но остаются в общей выручке. Нарушение — когда
    дерева нет вовсе или в нём лишь незначительная часть продаж.
    """
    rows = _olap(client, ['DishGroup.TopParent'], ['DishDiscountSumInt'],
                 date_from, date_to)
    # Сопоставление через resolve_unit — та же терпимость к регистру
    # и пробелам, что у боевого кода: аудит и дашборд не могут разойтись.
    in_tree = sum(r['DishDiscountSumInt'] for r in rows
                  if resolve_unit(r['DishGroup.TopParent']) != CAT_OTHER)
    total = sum(r['DishDiscountSumInt'] for r in rows)
    if not total:
        return ['за период нет продаж — аудит невозможен']
    outside = [r['DishGroup.TopParent'] for r in rows
               if resolve_unit(r['DishGroup.TopParent']) == CAT_OTHER]
    if in_tree == 0:
        return ['корневые папки Кухня/Бар/Вино отсутствуют — вся номенклатура '
                f'вне дерева ({len(outside)} групп в корне)']
    share = in_tree / total
    if share < 0.5:
        return [f'в папках Кухня/Бар/Вино лишь {share:.0%} выручки — '
                f'основное меню вне дерева ({len(outside)} групп в корне)']
    return []


def check_order_types(client, date_from, date_to) -> list[str]:
    """Раздел 2: типы заказов — только из стандартного набора, без пустых."""
    rows = _olap(client, ['OrderType'], ['DishDiscountSumInt'],
                 date_from, date_to)
    violations = []
    for r in rows:
        ot = r['OrderType']
        if ot is None:
            violations.append('заказы без типа '
                              f'(выручка {r["DishDiscountSumInt"]:,.0f})')
        elif ot not in STANDARD_ORDER_TYPES:
            violations.append(f'нестандартный тип заказа: {ot!r} '
                              f'(выручка {r["DishDiscountSumInt"]:,.0f})')
    return violations


def check_deleted_share(client, date_from, date_to) -> list[str]:
    """Раздел 5 (чек-лист): доля удалённого в выручке в пределах нормы."""
    rows = _olap(client, ['DeletedWithWriteoff', 'OrderDeleted'],
                 ['DishSumInt'], date_from, date_to, clean=False)
    deleted = sum(r['DishSumInt'] for r in rows
                  if r['DeletedWithWriteoff'] != 'NOT_DELETED'
                  or r['OrderDeleted'] != 'NOT_DELETED')
    total = sum(r['DishSumInt'] for r in rows)
    if not total:
        return ['за период нет продаж — аудит невозможен']
    share = deleted / total
    if share > DELETED_SHARE_LIMIT:
        return [f'доля удалённых заказов/блюд {share:.1%} '
                f'(порог {DELETED_SHARE_LIMIT:.0%}) — проверить дисциплину кассы']
    return []


def check_directory_hygiene(client, date_from, date_to) -> list[str]:
    """Раздел 5: категории без опечаток и «помоек»."""
    rows = _olap(client, ['DishCategory', 'DishGroup'], ['DishDiscountSumInt'],
                 date_from, date_to)
    violations = []
    for r in rows:
        cat, group = r['DishCategory'], r['DishGroup']
        if cat is None:
            violations.append('блюда без категории '
                              f'(группа {group!r}, выручка {r["DishDiscountSumInt"]:,.0f})')
        # начинается не с буквы/цифры — похоже на опечатку раскладки
        # (реальный случай: ',fh' = 'бар' в английской раскладке)
        elif not cat[0].isalnum():
            violations.append(f'категория похожа на опечатку: {cat!r}')
        if group == 'Удаленные':
            violations.append('продажи из группы «Удаленные» '
                              f'({r["DishDiscountSumInt"]:,.0f})')

    # Папка юнита с неканоничным написанием ('КУХНЯ ', 'вино'):
    # дашборд её поймёт (resolve_unit терпим), но имя надо поправить.
    rows_top = _olap(client, ['DishGroup.TopParent'], ['DishDiscountSumInt'],
                     date_from, date_to)
    for r in rows_top:
        top = r['DishGroup.TopParent']
        if resolve_unit(top) != CAT_OTHER and top not in STANDARD_UNITS:
            violations.append(f'имя папки отличается от канонического: {top!r} '
                              '— переименуйте (Кухня/Бар/Вино)')
    return violations


def run_all(client, date_from, date_to) -> dict[str, list[str]]:
    """Все проверки разом: имя проверки -> список нарушений."""
    return {
        'дерево номенклатуры': check_nomenclature_tree(client, date_from, date_to),
        'типы заказов': check_order_types(client, date_from, date_to),
        'доля удалённого': check_deleted_share(client, date_from, date_to),
        'гигиена справочников': check_directory_hygiene(client, date_from, date_to),
    }
