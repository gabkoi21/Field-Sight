"""Projects, teams, settings, locations, and assignments."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.identity import Role, utc_now


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    IN_REVIEW = "in_review"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Invitation(SQLModel, table=True):
    __tablename__ = "invitations"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    email: str = Field(sa_column=Column(String(320), index=True, nullable=False))
    role: Role
    token_hash: str = Field(sa_column=Column(String(64), unique=True, nullable=False))
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    accepted_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class OrganizationSettings(SQLModel, table=True):
    __tablename__ = "organization_settings"
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), primary_key=True))
    timezone: str = "UTC"
    country: str | None = None
    default_language: str = "en"
    retention_days: int = 365
    export_reason_required: bool = False
    notification_preferences: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_project_org_name"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    organization_sector_id: UUID = Field(
        sa_column=Column(ForeignKey("organization_sectors.id"), index=True, nullable=False)
    )
    name: str = Field(sa_column=Column(String(200), nullable=False))
    description: str = ""
    country: str | None = None
    status: ProjectStatus = ProjectStatus.DRAFT
    start_date: date | None = None
    end_date: date | None = None
    target_sample_size: int | None = None
    is_private: bool = False
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    kobo_connection_id: UUID | None = Field(
        default=None, sa_column=Column(ForeignKey("kobo_connections.id"), nullable=True)
    )
    kobo_form_id: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    kobo_form_name: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))


class Location(SQLModel, table=True):
    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_location_org_code"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    parent_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("locations.id")))
    code: str
    name: str
    level: str = "site"
    is_active: bool = True


class KoboConnection(SQLModel, table=True):
    __tablename__ = "kobo_connections"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_kobo_connection_org_name"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    name: str = Field(sa_column=Column(String(120), nullable=False))
    server_url: str = Field(sa_column=Column(String(255), nullable=False))
    token_encrypted: str = Field(sa_column=Column(String, nullable=False))
    selected_form_id: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    selected_form_name: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    is_verified: bool = Field(default=False, nullable=False)
    verified_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SyncRun(SQLModel, table=True):
    __tablename__ = "sync_runs"
    __table_args__ = (Index("ix_sync_runs_org_project_started_at", "organization_id", "project_id", "started_at"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    kobo_connection_id: UUID = Field(sa_column=Column(ForeignKey("kobo_connections.id"), nullable=False))
    kobo_form_id: str = Field(sa_column=Column(String(255), nullable=False))
    status: str = Field(default="completed", sa_column=Column(String(32), nullable=False))
    received_count: int = 0
    created_count: int = 0
    updated_count: int = 0
    error_message: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    started_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    completed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class Submission(SQLModel, table=True):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("project_id", "external_id", name="uq_submission_project_external_id"),
        Index("ix_submissions_org_submitted_at", "organization_id", "submitted_at"),
        Index("ix_submissions_org_project_submitted_at", "organization_id", "project_id", "submitted_at"),
        Index("ix_submissions_org_review_submitted_at", "organization_id", "review_status", "submitted_at"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    kobo_connection_id: UUID = Field(sa_column=Column(ForeignKey("kobo_connections.id"), nullable=False))
    kobo_form_id: str = Field(sa_column=Column(String(255), nullable=False))
    external_id: str = Field(sa_column=Column(String(255), nullable=False))
    submitted_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    enumerator: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    location: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    review_status: str = Field(default="ready", sa_column=Column(String(32), nullable=False))
    raw_answers: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class FieldMapping(SQLModel, table=True):
    __tablename__ = "field_mappings"
    __table_args__ = (UniqueConstraint("project_id", "source_field", name="uq_field_mapping_project_source"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    source_field: str = Field(sa_column=Column(String(255), nullable=False))
    display_name: str = Field(sa_column=Column(String(200), nullable=False))
    meaning: str | None = Field(default=None, sa_column=Column(String(200), nullable=True))
    data_type: str = Field(default="text", sa_column=Column(String(32), nullable=False))
    is_required: bool = False
    is_location: bool = False
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class ProjectTarget(SQLModel, table=True):
    __tablename__ = "project_targets"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    field_mapping_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("field_mappings.id")))
    name: str = Field(sa_column=Column(String(200), nullable=False))
    target_value: float
    unit: str = Field(default="records", sa_column=Column(String(80), nullable=False))
    direction: str = Field(default="at_least", sa_column=Column(String(20), nullable=False))
    due_date: date | None = None
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class FieldAssignment(SQLModel, table=True):
    __tablename__ = "field_assignments"
    __table_args__ = (
        UniqueConstraint("organization_id", "membership_id", "project_id", "location_id", name="uq_assignment_scope"),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    membership_id: UUID = Field(sa_column=Column(ForeignKey("organization_memberships.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    location_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("locations.id")))
    daily_target: int = 0
    effective_from: date | None = None
    effective_to: date | None = None
    is_enabled: bool = True
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
