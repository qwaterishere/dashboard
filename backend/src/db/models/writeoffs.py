"""Акты списания из iiko (OLAP TRANSACTIONS, тип WRITEOFF).

Строка = агрегат дня по (счёт списания, продукт): достаточно для блока
losses фудкоста (суммы по типам потерь) и детализации «что именно
списали». Инвентаризационные корректировки сюда НЕ пишутся — отдельный
тип транзакции и отдельная история.

Синк ежедневно перечитывает окно последних дней (акты проводятся задним
числом) и НЕ перезаписывает слепо: upsert по естественному ключу, чтобы
пережили first_seen_at/last_changed_at — наше наблюдение «когда акт
физически внесли» (метрика дисциплины бухгалтерии).
"""
import uuid
from decimal import Decimal
from datetime import date, datetime

from sqlalchemy import (
    Boolean, DECIMAL, Date, DateTime, ForeignKey, String, UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.db.session import Base


class WriteoffEntry(Base):
    __tablename__ = "writeoff_entries"
    __table_args__ = (
        # Естественный ключ агрегата: день х счёт х продукт.
        # product_id nullable в iiko не бывает у WRITEOFF, но страхуемся
        # на уровне кода, не ключа.
        UniqueConstraint("restaurant_id", "day", "account_name", "product_id",
                         name="uq_writeoff_row"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False,
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)

    # Счёт списания как назван в iiko («Порча Кухня», «Бракераж»...) —
    # сырое имя храним всегда: резолвер может меняться, источник — нет.
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Тип потери из маркерного резолвера (domain/constants.py).
    # Считается при записи; меняется перезаливкой при смене резолвера.
    loss_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # Юнит из суффикса счёта («Порча Кухня» -> k); None — счёт без юнита.
    unit: Mapped[str | None] = mapped_column(String(1), nullable=True)

    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)

    amount: Mapped[Decimal] = mapped_column(DECIMAL(12, 3), nullable=False)
    sum: Mapped[Decimal] = mapped_column(DECIMAL(14, 2), nullable=False)

    # Сторно: минусовая проводка на счёте потерь (гашение акта обратной
    # записью). Ловим и храним ЯВНО — для отображения «есть сторно на N»,
    # но в суммы категорий такие строки НЕ входят (читающая сторона
    # фильтрует storno == False). Складская сторона проводки сюда
    # не попадает вовсе — отбрасывается при синке.
    storno: Mapped[bool] = mapped_column(Boolean, nullable=False,
                                         default=False)

    # --- наблюдение за работой бухгалтера (не данные iiko!) ---
    # Когда МЫ впервые увидели строку в выгрузке: прокси «когда акт
    # внесли». Точность — сутки (частота синка). first_seen_at - day =
    # лаг проводки, метрика дисциплины учёта.
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow,
    )
    last_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True,
    )
