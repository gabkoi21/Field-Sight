"""Durable recurring table reports and downloadable report history."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, LargeBinary, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.identity import utc_now


class TableExportSchedule(SQLModel, table=True):
    __tablename__ = "table_export_schedules"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    project_id: UUID = Field(foreign_key="projects.id", index=True)
    form_id: str
    created_by_id: UUID = Field(foreign_key="users.id")
    options: dict = Field(sa_column=Column(JSON, nullable=False))
    active: bool = True
    next_run_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    last_error: str | None = None
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class TableExportArtifact(SQLModel, table=True):
    __tablename__ = "table_export_artifacts"
    __table_args__ = (UniqueConstraint("schedule_id", "period_start", name="uq_table_report_period"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    schedule_id: UUID = Field(foreign_key="table_export_schedules.id", index=True)
    period_start: str
    period_end: str
    filename: str
    media_type: str
    content: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
