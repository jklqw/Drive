import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("full_name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Full name is required")
        return value

    @field_validator("password")
    @classmethod
    def strong_password(cls, value: str) -> str:
        if not re.search(r"[a-z]", value) or not re.search(r"[A-Z]", value):
            raise ValueError("Password must contain uppercase and lowercase letters")
        if not re.search(r"\d", value):
            raise ValueError("Password must contain a digit")
        if not re.search(r"[^A-Za-z0-9]", value):
            raise ValueError("Password must contain a special character")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    storage_quota_bytes: int
    storage_used_bytes: int
    is_active: bool
    created_at: datetime
