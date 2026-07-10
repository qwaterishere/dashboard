"""Контракты auth API."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from src.core.config import get_settings
from src.core.password_policy import validate_password
from src.schemas.base import StrictModel


class RegisterRequest(StrictModel):
    email: EmailStr
    password: Annotated[str, Field(max_length=128)]
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=100)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("first_name", "last_name", "position", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("password")
    @classmethod
    def check_password_policy(cls, value: str) -> str:
        return validate_password(value, get_settings())


class LoginRequest(StrictModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip().lower()


class TokenResponse(StrictModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserPublic(StrictModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    position: str
    created_at: datetime
