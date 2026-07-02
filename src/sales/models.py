from sqlalchemy import Column, Date, Integer, String, DECIMAL, ForeignKey, Uuid, UniqueConstraint
from sqlalchemy.orm import relationship

from src.database import Base


class Order(Base):
    """Заказы в рамках смены, они же по факту являются столами или чеками"""

    __tablename__ = 'orders'
    __table_args__ = (
        UniqueConstraint('order_number', 'session_number', 'day', name='uq_order'),
    )  # Заказ уникален в связке номер+смена+день: один OrderNum

    id = Column(Integer, index=True, primary_key=True, autoincrement=True)
    order_number = Column(Integer, nullable=False)
    session_number = Column(Integer, nullable=False)
    day = Column(Date, nullable=False)
    guests_number = Column(Integer, nullable=False)
    # PayTypes.Group: CARD / CASH; 'MIXED' — сплит-оплата разными способами;
    # None — чек без оплаты (комплимент).
    pay_type = Column(String, nullable=True)
    pay_type_name = Column(String, nullable=True)  # PayTypes: Optima POS / QR / Яндекс / Наличные
    order_type = Column(String, nullable=True)     # OrderType: Обычный заказ / Конференции / Бар ...

    dish_sales = relationship('DishSale', back_populates='order')

    def __repr__(self):
        return (f'<Order(id={self.id}, order_number={self.order_number}, session={self.session_number},'
                f'day={self.day}, guests={self.guests_number})>')


class DishSale(Base):
    """Реализация блюда с уникальным айди. В одном заказе может быть много идентичных позиций"""

    __tablename__ = 'dish_sales'

    id = Column(Uuid, primary_key=True)
    name = Column(String, nullable=False)
    cost = Column(DECIMAL(10, 4), nullable=True)
    price = Column(DECIMAL(10, 4), nullable=False)      # сумма без скидки (прейскурант)
    paid_sum = Column(DECIMAL(10, 4), nullable=False)   # фактически уплачено — источник выручки
    discount = Column(DECIMAL(10, 4), nullable=True)
    dish_category = Column(String, nullable=False)
    dish_group = Column(String, nullable=False)

    order_id = Column(Integer, ForeignKey('orders.id'), nullable=False)

    order = relationship('Order', back_populates='dish_sales')

    def __repr__(self):
        return (f'<Dish(id={self.id}, name={self.name}, cost={self.cost}, price={self.price}, '
                f'discount={self.discount}, dish_category={self.dish_category}, dish_group={self.dish_group})>')
