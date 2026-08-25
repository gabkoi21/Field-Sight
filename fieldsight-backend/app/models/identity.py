"""Identity and tenant SQLModel tables for Phase 2."""

from __future__ import annotations

from datetime import UTC, date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class Role(StrEnum):
    SUPER_ADMIN = "super_admin"
    ORGANIZATION_ADMIN = "organization_admin"
    ENUMERATOR = "enumerator"


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(sa_column=Column(String(320), unique=True, index=True, nullable=False))
    username: str | None = Field(default=None, sa_column=Column(String(100), unique=True, index=True, nullable=True))
    full_name: str | None = Field(default=None, sa_column=Column(String(200), nullable=True))
    phone_number: str | None = Field(default=None, sa_column=Column(String(32), nullable=True))
    employee_id: str | None = Field(default=None, sa_column=Column(String(64), nullable=True))
    gender: str | None = Field(default=None, sa_column=Column(String(32), nullable=True))
    date_of_birth: date | None = Field(default=None, sa_column=Column(Date, nullable=True))
    address: str | None = Field(default=None, sa_column=Column(String(300), nullable=True))
    emergency_contact_name: str | None = Field(default=None, sa_column=Column(String(200), nullable=True))
    emergency_contact_phone: str | None = Field(default=None, sa_column=Column(String(32), nullable=True))
    notes: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    password_hash: str
    is_active: bool = Field(default=True, nullable=False)
    platform_role: Role | None = Field(default=None, sa_column=Column(Enum(Role), nullable=True))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class Organization(SQLModel, table=True):
    __tablename__ = "organizations"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(200), nullable=False))
    slug: str = Field(sa_column=Column(String(100), unique=True, index=True, nullable=False))
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class OrganizationMembership(SQLModel, table=True):
    __tablename__ = "organization_memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_membership_org_user"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    user_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), index=True, nullable=False))
    role: Role = Field(sa_column=Column(Enum(Role), nullable=False))
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class RefreshSession(SQLModel, table=True):
    __tablename__ = "refresh_sessions"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), index=True, nullable=False))
    token_hash: str = Field(sa_column=Column(String(64), unique=True, index=True, nullable=False))
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    revoked_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    replaced_by_id: UUID | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class Sector(SQLModel, table=True):
    __tablename__ = "sectors"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    code: str = Field(sa_column=Column(String(64), unique=True, nullable=False))
    name: str = Field(sa_column=Column(String(120), nullable=False))
    is_active: bool = Field(default=True, nullable=False)


class OrganizationSector(SQLModel, table=True):
    __tablename__ = "organization_sectors"
    __table_args__ = (UniqueConstraint("organization_id", "sector_id", name="uq_organization_sector"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    sector_id: UUID = Field(sa_column=Column(ForeignKey("sectors.id"), index=True, nullable=False))
    is_active: bool = Field(default=True, nullable=False)
