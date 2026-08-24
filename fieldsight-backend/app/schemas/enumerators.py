"""Enumerator account creation schemas."""

from pydantic import BaseModel, EmailStr, Field


class EnumeratorCreate(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=100)
    password: str = Field(min_length=12, max_length=1024)
