"""Platform-administration request schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SectorCreate(BaseModel):
    code: str = Field(pattern=r"^[a-z][a-z0-9_]{1,63}$")
    name: str = Field(min_length=2, max_length=120)


class SectorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    is_active: bool | None = None


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    owner_email: EmailStr
    owner_username: str | None = Field(default=None, min_length=3, max_length=100)
    owner_password: str = Field(min_length=8, max_length=1024)
    owner_role: Literal["organization_admin"] = "organization_admin"
    sector_ids: list[UUID] = Field(default_factory=list)
    country: str | None = Field(default=None, max_length=100)
    timezone: str = Field(default="UTC", max_length=64)


class OrganizationListItem(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    created_at: datetime
    country: str | None
    timezone: str
    owner_email: EmailStr | None
    sector_ids: list[UUID]


class UserOrganizationAccess(BaseModel):
    organization_id: UUID
    organization_name: str
    role: str
    is_active: bool


class UserDirectoryItem(BaseModel):
    id: UUID
    email: str
    username: str | None
    full_name: str | None
    is_active: bool
    platform_role: str | None
    created_at: datetime
    memberships: list[UserOrganizationAccess]