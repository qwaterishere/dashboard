"""Глобальные константы продукта (одинаковы для любого ресторана).

Терминология разрезов (docs/frontend-handoff.md):
  unit     — направление: папка 1-го уровня дерева iiko; Кухня/Бар/Вино ->
             k/b/w, всё вне этих папок -> 'o' («вне подразделений»);
  group    — папка, в которой лежит блюдо (DishGroup, любая глубина);
             каждая group принадлежит ровно одному unit;
  category — категория блюда (DishCategory): независимый от дерева
             атрибут-справочник, параллельный разрез.
В БД: top_group — сырьё для unit (ИМЯ папки, ключ делает resolve_unit);
dish_group -> group; dish_category -> category.

Стандарт внедрения (docs/iiko-setup-standard.md): дашборд читает только
три корневые папки номенклатуры iiko. Юнит блюда = его папка 1-го уровня;
всё вне папок — «вне подразделений» (CAT_OTHER): участвует в общей выручке,
но не в разрезах по юнитам. Ресторан управляет этим сам, перенося группы
в iikoOffice, — код от справочников ресторана не зависит.
"""

# Канонические имена корневых папок в iiko -> ключи юнитов дашборда
UNIT_BY_TOP_GROUP = {
    "Кухня": "k",
    "Бар": "b",
    "Вино": "w",
}

STANDARD_UNITS = set(UNIT_BY_TOP_GROUP) # {'Кухня', 'Бар', 'Вино'}

CAT_OTHER = "o" # «вне подразделений»

_UNIT_BY_NORMALIZED = {name.lower(): unit for name, unit in UNIT_BY_TOP_GROUP.items()}


def resolve_unit(top_group: str | None) -> str:
    """Юнит по имени папки 1-го уровня; терпима к регистру и пробелам.

    None (блюдо без группы) — «вне подразделений».
    """
    if top_group is None:
        return CAT_OTHER
    return _UNIT_BY_NORMALIZED.get(top_group.strip().lower(), CAT_OTHER)


# Канонические имена СКЛАДОВ → юнит (docs/iiko-setup-standard.md):
# как resolve_unit у папок номенклатуры, без отдельного маппинга.
# Склады с другими именами («Хозка», «Посуда», …) в аналитику не попадают.
STORE_UNIT_BY_NAME = {
    "кухня": "k",
    "бар": "b",
    "вино": "w",
}


def resolve_store_unit(name: str | None) -> str | None:
    """Юнит склада по каноническому имени; None — склад вне аналитики."""
    if name is None:
        return None
    return STORE_UNIT_BY_NAME.get(name.strip().lower())


# Маркеры типов потерь в именах счетов списания (WRITEOFF-акты).
# Стандарт именования и есть настройка: счёт с маркером подхватывается
# без кода, счёт без маркера честно попадает в other (видим в данных —
# сигнал переименовать счёт при аудите). Проверено на живых счетах
# Ташкента и Бишкека (08.2026): «Порча Кухня», «Стаф питание»,
# «Слив масла фритюрного», «Завтрак Отель»...
LOSS_TYPE_MARKERS: tuple[tuple[str, str], ...] = (
    ("порч", "spoilage"),
    ("бракераж", "brak"),
    ("дегустац", "tasting"),
    ("проработ", "tasting"),
    ("комплимент", "compliment"),
    ("комплемент", "compliment"),   # орфография пилота
    ("сотрудник", "staff"),
    ("служебное питание", "staff"),
    ("стаф", "staff"),              # покрывает «стафф» и «стаф»
    ("блогер", "blogger"),
    ("реклама", "marketing"),
    ("маркетинг", "marketing"),
    ("удаление", "deletion"),
    # технологические списания — не потери качества:
    ("фритюр", "operational"),
    ("слив масла", "operational"),
    ("помол", "operational"),
    # расходники заведения — не еда (массовые акты конца месяца):
    ("хозтовар", "supplies"),
    ("хоз.товар", "supplies"),
    ("уголь", "supplies"),
    ("дрова", "supplies"),
    ("упаковк", "supplies"),
    ("посуда", "supplies"),
    ("лед пищевой", "supplies"),
    ("лёд пищевой", "supplies"),
    # съёмки контента — маркетинг натурой:
    ("фотограф", "marketing"),
    ("фотосесс", "marketing"),
    ("видеосъем", "marketing"),
    # контрактное питание (кейс Бишкека — кафе при отеле):
    ("отел", "hotel"),
)


def resolve_loss_account(account_name: str) -> tuple[str, str | None]:
    """(тип потери, юнит) по имени счёта списания.

    «Порча Кухня» -> ('spoilage', 'k'); «Бракераж» -> ('brak', None);
    незнакомый счёт -> ('other', None) — виден в данных, не теряется.
    """
    low = account_name.strip().lower()
    loss_type = next(
        (t for marker, t in LOSS_TYPE_MARKERS if marker in low), "other",
    )
    unit = next(
        (u for name, u in STORE_UNIT_BY_NAME.items() if name in low), None,
    )
    return loss_type, unit
