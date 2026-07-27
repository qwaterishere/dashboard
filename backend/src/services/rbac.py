"""RBAC helpers и audit trail для чувствительных мутаций."""

from __future__ import annotations

import logging
from typing import Iterable
from uuid import UUID

logger = logging.getLogger("src.audit")

# Роли продукта: manager | accountant | warehouse
ROLE_MANAGER = "manager"
ROLE_ACCOUNTANT = "accountant"
ROLE_WAREHOUSE = "warehouse"
ALL_ROLES = frozenset({ROLE_MANAGER, ROLE_ACCOUNTANT, ROLE_WAREHOUSE})


def audit_event(
    *,
    action: str,
    user_id: UUID | None,
    restaurant_id: UUID | None = None,
    detail: str | None = None,
) -> None:
    """Структурированная запись audit (JSON-friendly message)."""
    logger.info(
        "audit action=%s user_id=%s restaurant_id=%s detail=%s",
        action,
        user_id,
        restaurant_id,
        detail or "",
    )


def role_allowed(user_role: str, allowed: Iterable[str]) -> bool:
    return user_role in set(allowed)
