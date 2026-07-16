import uuid
from decimal import Decimal
from datetime import date

from sqlalchemy import UniqueConstraint, CheckConstraint, Uuid, ForeignKey, Date, String, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column

from src.db.session import Base


class StockBalance(Base):
    """Строка ежедневного слепка остатков — конец закрытого дня.

    Повторный синк дня перезаписывает строки (replace, как продажи).
    qty/value хранятся КАК ЕСТЬ, включая отрицательные: правило
    «минус не в тотал» применяется на чтении. Имена — снапшот
    справочника на момент синка: старые слепки хранят старые имена,
    идентичность — product_id. Ретеншн: день — скользящий год,
    старше — только воскресенья (прореживание при синке).

    Одна запись - один день х один склад х один продукт
    """

    __tablename__ = "stock_balances"
    __table_args__ = (
        # store_id (не unit) в ключе: два склада могут мапиться в один
        # юнит и держать один продукт — строки не должны слипаться
        UniqueConstraint("restaurant_id", "day", "store_id", "product_id",
                         name="uq_stock_snapshot_row"),
        # база сама отбивает кривой юнит. в базе только то, что есть в онбординге (k,b,w)
        CheckConstraint("store_unit IN ('k', 'b', 'w')",
                        name="ck_stock_store_unit"),
    )
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False,
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)

    store_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    store_unit: Mapped[str] = mapped_column(String(1), nullable=False)
    # ^ денормализован из маппинга: фиксирует, каким юнит БЫЛ на момент
    #   слепка — перемаппинг склада не переписывает историю

    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    category: Mapped[str] = mapped_column(String(200), nullable=False)
    unit_name: Mapped[str] = mapped_column(String(20), nullable=False)

    qty: Mapped[Decimal] = mapped_column(DECIMAL(12, 3), nullable=False)
    value: Mapped[Decimal] = mapped_column(DECIMAL(14, 2), nullable=False)
