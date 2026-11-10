"""Saved reporting documents and durable immutable publication artifacts."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, Index, LargeBinary, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.identity import utc_now


class Report(SQLModel, table=True):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_tenant_project", "organization_id", "project_id"),
        Index("ix_reports_project_status", "project_id", "status"),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    project_id: UUID = Field(foreign_key="projects.id")
    template_key: str
    title: str
    description: str = ""
    reporting_period_start: date
    reporting_period_end: date
    status: str = "draft"
    content: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_by_id: UUID = Field(foreign_key="users.id")
    updated_by_id: UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=utc_now, index=True)
    updated_at: datetime = Field(default_factory=utc_now)
    published_at: datetime | None = None
    published_by_id: UUID | None = Field(default=None, foreign_key="users.id")
    revision_number: int = 1


class ReportSnapshot(SQLModel, table=True):
    __tablename__ = "report_snapshots"
    __table_args__ = (UniqueConstraint("report_id", "snapshot_version"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    report_id: UUID = Field(foreign_key="reports.id", unique=True)
    organization_id: UUID = Field(foreign_key="organizations.id")
    project_id: UUID = Field(foreign_key="projects.id")
    snapshot_version: int = 1
    snapshot_data: dict = Field(sa_column=Column(JSON, nullable=False))
    generated_at: datetime = Field(default_factory=utc_now)
    generated_by_id: UUID = Field(foreign_key="users.id")
    content_hash: str
    pdf_data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
