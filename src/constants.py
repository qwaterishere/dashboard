"""Глобальные константы продукта (одинаковы для любого ресторана).

Стандарт внедрения (docs/iiko-setup-standard.md): дашборд читает только
три корневые папки номенклатуры iiko. Юнит блюда = его папка 1-го уровня;
всё вне папок — «вне подразделений» (CAT_OTHER): участвует в общей выручке,
но не в разрезах по юнитам. Ресторан управляет этим сам, перенося группы
в iikoOffice, — код от справочников ресторана не зависит.
"""

# Канонические имена корневых папок в iiko -> ключи юнитов дашборда
UNIT_BY_TOP_GROUP = {
    'Кухня': 'k',
    'Бар': 'b',
    'Вино': 'w',
}

STANDARD_UNITS = set(UNIT_BY_TOP_GROUP)   # {'Кухня', 'Бар', 'Вино'}

CAT_OTHER = 'o'   # «вне подразделений»

_UNIT_BY_NORMALIZED = {name.lower(): unit for name, unit in UNIT_BY_TOP_GROUP.items()}


def resolve_unit(top_group: str | None) -> str:
    """Юнит по имени папки 1-го уровня; терпима к регистру и пробелам.

    None (блюдо без группы) — «вне подразделений».
    """
    if top_group is None:
        return CAT_OTHER
    return _UNIT_BY_NORMALIZED.get(top_group.strip().lower(), CAT_OTHER)
