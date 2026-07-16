from sqlalchemy import Column, Date, Integer, String, DECIMAL, ForeignKey, Uuid, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from src.db.session import Base


class Order(Base):
    """Заказы в рамках смены, они же по факту являются столами или чеками"""

    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint(
            "restaurant_id",
            "order_number",
            "session_number",
            "day",
            name="uq_order_restaurant",
        ),
        Index("ix_orders_restaurant_id", "restaurant_id"),
    )

    id = Column(Integer, index=True, primary_key=True, autoincrement=True)
    restaurant_id = Column(Uuid, ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=True)
    order_number = Column(Integer, nullable=False)
    session_number = Column(Integer, nullable=False)
    day = Column(Date, nullable=False)
    guests_number = Column(Integer, nullable=False)
    # Сумма paid_sum блюд чека (считается при ingest). 0 — чек целиком
    # бесплатный (представительские, стафф): не участвует в продажных
    # метриках (чеки/гости/средний чек), но остаётся в данных.
    paid_total = Column(DECIMAL(12, 4), nullable=False)
    # PayTypes.Group: CARD / CASH; 'MIXED' — сплит-оплата разными способами;
    # None — чек без оплаты (комплимент).
    pay_type = Column(String, nullable=True)
    pay_type_name = Column(String, nullable=True) # PayTypes: Optima POS / QR / Яндекс / Наличные
    order_type = Column(String, nullable=True) # OrderType: Обычный заказ / Конференции / Бар ...

    dish_sales = relationship("DishSale", back_populates="order")

    def __repr__(self):
        return (
            f"<Order(id={self.id}, order_number={self.order_number}, "
            f"session={self.session_number}, day={self.day}, guests={self.guests_number})>"
        )


class DishSale(Base):
    """Реализация блюда с уникальным айди. В одном заказе может быть много идентичных позиций"""

    __tablename__ = "dish_sales"

    id = Column(Uuid, primary_key=True)
    name = Column(String, nullable=False)
    cost = Column(DECIMAL(10, 4), nullable=True)
    price = Column(DECIMAL(10, 4), nullable=False) # сумма без скидки (прейскурант)
    paid_sum = Column(DECIMAL(10, 4), nullable=False) # фактически уплачено — источник выручки
    amount = Column(DECIMAL(12, 3), nullable=False) # порций (дробное у весовых блюд)
    discount = Column(DECIMAL(10, 4), nullable=True)
    dish_category = Column(String, nullable=False)
    dish_group = Column(String, nullable=False)
    top_group = Column(String, nullable=True) # папка 1-го уровня -> юнит; None = блюдо без группы

    # Идентичность справочников iiko: склейка переименований (имя — снапшот
    # на момент продажи, id вечен; читатель группирует по id и берёт имя
    # последней продажи). У category_id назначения в продукте
    # пока нет — копим впрок.
    dish_id = Column(Uuid, nullable=True)
    group_id = Column(Uuid, nullable=True)
    category_id = Column(Uuid, nullable=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)

    order = relationship("Order", back_populates="dish_sales")

    def __repr__(self):
        return (
            f"<Dish(id={self.id}, name={self.name}, cost={self.cost}, "
            f"price={self.price}, discount={self.discount}, "
            f"dish_category={self.dish_category}, dish_group={self.dish_group})>"
        )
