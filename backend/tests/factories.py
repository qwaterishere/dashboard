"""Test factories."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from src.core.security import hash_password
from src.db.models.restaurant import Restaurant
from src.db.models.user import User


def create_restaurant(session: Session) -> Restaurant:
    user = User(
        email=f"tenant-{uuid.uuid4()}@test.com",
        password_hash=hash_password("TestPass123!"),
        first_name="Test",
        last_name="User",
        position="Управляющий",
    )
    session.add(user)
    session.flush()
    restaurant = Restaurant(user_id=user.id)
    session.add(restaurant)
    session.flush()
    return restaurant
