"""Baseline schema: create_all + critical indexes.

Revision ID: 20260726_0001
Revises:
Create Date: 2026-07-26
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260726_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from src.db.session import Base
    import src.db.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

    # Indexes that may predate create_all on existing DBs
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_orders_restaurant_day "
            "ON orders (restaurant_id, day)"
        )
    )
    op.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_dish_sales_order_id "
            "ON dish_sales (order_id)"
        )
    )


def downgrade() -> None:
    from src.db.session import Base
    import src.db.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
