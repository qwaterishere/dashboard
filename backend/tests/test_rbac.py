"""RBAC helpers."""

from src.services.rbac import ROLE_MANAGER, role_allowed


def test_role_allowed():
    assert role_allowed(ROLE_MANAGER, [ROLE_MANAGER, 'accountant'])
    assert not role_allowed('warehouse', [ROLE_MANAGER])
