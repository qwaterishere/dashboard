"""Minimal sales seed for Playwright e2e (fresh sqlite from e2e-backend.sh)."""

from __future__ import annotations

import os
import uuid
from datetime import date

from sqlalchemy import select

from src.db.models.user import User
from src.db.session import Base, DataBaseManager
from src.schemas.auth import RegisterRequest
from src.services.auth import register_user
from src.services.restaurant import get_or_create_restaurant
from src.services.sales import ingest_records, parse_records

E2E_EMAIL = 'e2e@example.com'
E2E_PASSWORD = 'E2ePass123!'


def _sale(day: str, order: int, paid: float) -> dict:
    uid = str(uuid.uuid4())
    return {
        'DiscountSum': 0,
        'DishCategory': 'Прочее',
        'DishGroup': 'Прочее',
        'DishGroup.TopParent': 'Кухня',
        'DishName': 'E2E dish',
        'DishSumInt': paid,
        'DishDiscountSumInt': paid,
        'DishAmountInt': 1,
        'GuestNum': 2,
        'ItemSaleEvent.Id': uid,
        'OpenDate.Typed': day,
        'OrderNum': order,
        'PayTypes.Group': 'CARD',
        'PayTypes': 'Optima POS',
        'OrderType': 'Обычный заказ',
        'ProductCostBase.ProductCost': paid * 0.3,
        'SessionNum': 900,
    }


def main() -> None:
    db_url = os.environ.get('DB_URL', 'sqlite:///./e2e-dashboard.db')
    manager = DataBaseManager(db_url)
    Base.metadata.create_all(manager.engine)

    session = manager.get_session()
    try:
        user = session.scalar(select(User).where(User.email == E2E_EMAIL))
        if user is None:
            register_user(
                session,
                RegisterRequest(
                    email=E2E_EMAIL,
                    password=E2E_PASSWORD,
                    first_name='E2E',
                    last_name='Тест',
                    position='Управляющий',
                ),
            )
            session.commit()
            user = session.scalar(select(User).where(User.email == E2E_EMAIL))
        if user is None:
            raise RuntimeError('Failed to create e2e user')

        restaurant = get_or_create_restaurant(session, user)

        today = date.today()
        day_iso = today.isoformat()
        ingest_records(
            session,
            parse_records([
                _sale(day_iso, 1, 1200),
                _sale(day_iso, 2, 800),
            ]),
            restaurant_id=restaurant.id,
        )
        session.commit()
    finally:
        session.close()


if __name__ == '__main__':
    main()
