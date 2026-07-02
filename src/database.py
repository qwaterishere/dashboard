"""Подключение к БД: менеджер с engine и фабрикой сессий, база моделей.

Модуль создаёт один экземпляр DataBaseManager на приложение (db_manager).
Код доменов получает сессию через FastAPI-зависимость get_db,
в тестах можно создать свой менеджер с другим url (например sqlite:///:memory:).
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from src.config import DB_URL

Base = declarative_base()


class DataBaseManager:
    def __init__(self, db_url: str = DB_URL):
        # check_same_thread нужен только SQLite: FastAPI обслуживает запросы
        # в нескольких потоках, а драйвер по умолчанию это запрещает.
        connect_args = {'check_same_thread': False} if db_url.startswith('sqlite') else {}
        self.engine = create_engine(db_url, connect_args=connect_args)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)

    def create_all(self) -> None:
        """Создаёт отсутствующие таблицы (существующие не трогает)."""
        # Импорт нужен, чтобы модели зарегистрировались в Base.metadata
        # до вызова create_all — иначе таблицы не будут созданы.
        from src.sales import models  # noqa: F401

        Base.metadata.create_all(self.engine)

    def get_session(self):
        """Новая сессия при каждом вызове."""
        return self.Session()


# Единственный экземпляр на приложение: модуль импортируется один раз,
# поэтому engine и пул соединений тоже создаются один раз.
db_manager = DataBaseManager()


def get_db():
    """FastAPI-зависимость: новая сессия на запрос, закрытие после ответа."""
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()
