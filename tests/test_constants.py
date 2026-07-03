"""Тесты сопоставления папки 1-го уровня с юнитом дашборда."""

from src.constants import resolve_unit, CAT_OTHER


def test_canonical_names():
    assert resolve_unit('Кухня') == 'k'
    assert resolve_unit('Бар') == 'b'
    assert resolve_unit('Вино') == 'w'


def test_tolerates_case_and_whitespace():
    assert resolve_unit('КУХНЯ ') == 'k'
    assert resolve_unit('  вино') == 'w'
    assert resolve_unit('бАр') == 'b'


def test_unknown_folder_is_other():
    assert resolve_unit('Кальяны') == CAT_OTHER
    assert resolve_unit('Хоспер') == CAT_OTHER
    assert resolve_unit('') == CAT_OTHER
