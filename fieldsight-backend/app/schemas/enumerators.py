"""Enumerator account schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class EnumeratorCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    project_id: UUID | None = None
    password: str | None = Field(default=None, min_length=1, max_length=1024)
    phone_number: str | None = Field(default=None, max_length=32)
    gender: str | None = Field(default=None, max_length=32)
    date_of_birth: date | None = None
    address: str | None = Field(default=None, max_length=300)
    emergency_contact_name: str | None = Field(default=None, max_length=200)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


class EnumeratorRead(BaseModel):
    user_id: UUID
    membership_id: UUID
    email: EmailStr
    username: str | None
    full_name: str | None
    phone_number: str | None
    employee_id: str | None
    gender: str | None
    date_of_birth: date | None
    address: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    notes: str | None
    role: str
    is_active: bool
    created_at: datetime
