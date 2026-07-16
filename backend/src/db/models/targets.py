"""Месячные цели ресторана (без наследования из прошлого месяца)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from src.db.session import Base


class MonthlyTarget(Base):
    __tablename__ = "monthly_targets"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "year", "month", name="uq_monthly_target_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("restaurants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)

    revenue_month_plan: Mapped[float] = mapped_column(nullable=False, default=0.0)
    week_profile: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    daily_overrides: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    foodcost_goals: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    writeoffs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    compliments_goal_pct: Mapped[float] = mapped_column(nullable=False, default=0.0)
    inventory_goal_pct: Mapped[float] = mapped_column(nullable=False, default=0.0)
    locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
