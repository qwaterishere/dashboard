"""SQLAlchemy: engine, сессии, базовый класс моделей."""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from src.core.config import get_settings

Base = declarative_base()


class DataBaseManager:
    def __init__(self, db_url: str | None = None):
        url = db_url or get_settings().db_url
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        engine_kwargs: dict = {"connect_args": connect_args}
        if ":memory:" in url:
            engine_kwargs["poolclass"] = StaticPool
        self.engine = create_engine(url, **engine_kwargs)
        self.Session = sessionmaker(bind=self.engine, autoflush=False)

    def create_all(self) -> None:
        from src.db import migrate
        from src.db.models import restaurant, sales, user  # noqa: F401

        migrate.upgrade_schema(self.engine)

    def get_session(self):
        return self.Session()


db_manager = DataBaseManager()


def get_db():
    """FastAPI-зависимость: сессия на запрос."""
    db = db_manager.get_session()
    try:
        yield db
    finally:
        db.close()
