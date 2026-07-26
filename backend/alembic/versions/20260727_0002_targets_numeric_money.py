"""targets money/pct columns → Numeric

Revision ID: 20260727_0002
Revises: 20260726_0001
Create Date: 2026-07-27

PostgreSQL: ALTER COLUMN … TYPE NUMERIC.
SQLite: type changes are soft (affinity only); create_all / migrate.py
ensure columns exist for new DBs — see upgrade_schema docstring.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_0002"
down_revision: Union[str, None] = "20260726_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_MONEY_COLS = (
    "revenue_month_plan",
    "compliments_goal_rub",
    "inventory_goal_rub",
)
_PCT_COLS = (
    "compliments_goal_pct",
    "inventory_goal_pct",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite: affinity-only; columns already present via create_all / migrate.py
        return

    for col in _MONEY_COLS:
        op.execute(
            sa.text(
                f"ALTER TABLE monthly_targets "
                f"ALTER COLUMN {col} TYPE NUMERIC(14, 2) "
                f"USING {col}::numeric(14, 2)"
            )
        )
    for col in _PCT_COLS:
        op.execute(
            sa.text(
                f"ALTER TABLE monthly_targets "
                f"ALTER COLUMN {col} TYPE NUMERIC(8, 4) "
                f"USING {col}::numeric(8, 4)"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for col in (*_MONEY_COLS, *_PCT_COLS):
        op.execute(
            sa.text(
                f"ALTER TABLE monthly_targets "
                f"ALTER COLUMN {col} TYPE DOUBLE PRECISION "
                f"USING {col}::double precision"
            )
        )
