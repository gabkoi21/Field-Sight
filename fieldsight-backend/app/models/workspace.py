"""Persisted workspace onboarding, collected results and dashboard configuration."""

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlmodel import Field, SQLModel

from app.models.identity import utc_now


class WorkspaceInvitation(SQLModel, table=True):
    __tablename__ = "workspace_invitations"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False))
    email: str
    role: str = "enumerator"
    token_hash: str = Field(sa_column=Column(String(64), unique=True, nullable=False))
    created_by_id: UUID = Field(foreign_key="users.id")
    expires_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    accepted_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    revoked: bool = False


class UserPreference(SQLModel, table=True):
    __tablename__ = "user_preferences"
    user_id: UUID = Field(sa_column=Column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True))
    landing_page: str = "/projects"


class CollectedResult(SQLModel, table=True):
    __tablename__ = "collected_results"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    indicator_id: UUID = Field(
        sa_column=Column(ForeignKey("indicators.id", ondelete="CASCADE"), nullable=False, index=True)
    )
    organization_id: UUID = Field(foreign_key="organizations.id")
    result_date: date
    value: float | None = None
    narrative: str | None = None
    location: str | None = None
    notes: str | None = None
    created_by_id: UUID = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class AnalyticalDashboard(SQLModel, table=True):
    __tablename__ = "analytical_dashboards"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False))
    title: str
    description: str = ""
    created_by_id: UUID = Field(foreign_key="users.id")
    widgets: list[dict] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
