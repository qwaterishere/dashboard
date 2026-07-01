from sqlalchemy import create_engine, Column, Date, Integer, String, DECIMAL, ForeignKey, Uuid
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

Base = declarative_base()


class Order(Base):

    """Заказы в рамках смены, они же по факту являются столами или чеками"""

    __tablename__ = 'orders'

    id = Column(Integer, index=True, primary_key=True, autoincrement=True)
    order_number = Column(Integer, nullable=False)
    session_number = Column(Integer, nullable=False)
    day = Column(Date, nullable=False)
    guests_number = Column(Integer, nullable=False)

    dish_sales = relationship('DishSale', back_populates='order')

    def __repr__(self):
        return (f'<Order(id={self.id}, order_number={self.order_number}, session={self.session_number},'
                f'day={self.day}, guests={self.guests_number})>')


class DishSale(Base):

    """Реализация блюда с уникальным айди. В одном заказе может быть много идентичных позиций"""

    __tablename__ = 'dish_sales'

    id = Column(Uuid, primary_key=True, unique=True, nullable=False)
    name = Column(String, nullable=False)
    cost = Column(DECIMAL(10, 4), nullable=True)
    price = Column(DECIMAL(10, 4), nullable=False)
    discount = Column(DECIMAL(10, 4), nullable=True)
    dish_category = Column(String, nullable=False)
    dish_group = Column(String, nullable=False)

    order_id = Column(Integer, ForeignKey('orders.id'), nullable=False)

    order = relationship('Order', back_populates='dish_sales')

    def __repr__(self):
        return (f'<Dish(id={self.id}, name={self.name}, cost={self.cost}, price={self.price}, '
                f'discount={self.discount}, dish_category={self.dish_category}, dish_group={self.dish_group})>')


class DataBaseManager:
    def __init__(self, db_url: str = 'sqlite:///dashboard.db'):
        connect_args = {'check_same_thread': False} if db_url.startswith('sqlite') else {}
        self.engine = create_engine(url=db_url, connect_args=connect_args)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)  # returns a session factory (class)

    def create_all(self):
        Base.metadata.create_all(self.engine)

    def get_session(self):
        """self.Session - factory, self.Session() - new session each time"""
        return self.Session()
