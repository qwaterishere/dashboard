"""Контракты auth API."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import EmailStr, Field, field_validator, model_validator

from src.core.config import get_settings
from src.core.password_policy import validate_password
from src.schemas.base import StrictModel


class RegisterRequest(StrictModel):
    email: EmailStr
    password: Annotated[str, Field(max_length=128)]
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=100)
    invite_key: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("first_name", "last_name", "position", "invite_key", mode="before")
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
    token_type: str = "bearer"
    expires_in: int


class UserPublic(StrictModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    position: str
    created_at: datetime


class UpdateProfileRequest(StrictModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    position: str = Field(min_length=1, max_length=100)

    @field_validator("first_name", "last_name", "position", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class ChangePasswordRequest(StrictModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: Annotated[str, Field(max_length=128)]

    @field_validator("new_password")
    @classmethod
    def check_new_password(cls, value: str) -> str:
        return validate_password(value, get_settings())

    @model_validator(mode="after")
    def passwords_must_differ(self) -> ChangePasswordRequest:
        if self.current_password == self.new_password:
            raise ValueError("New password must differ from the current password")
        return self
