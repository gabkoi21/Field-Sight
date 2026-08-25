"""Enumerator account creation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class EnumeratorCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=12, max_length=1024)


class EnumeratorRead(BaseModel):
    user_id: UUID
    membership_id: UUID
    email: EmailStr
    username: str | None
    role: str
    is_active: bool
    created_at: datetime
