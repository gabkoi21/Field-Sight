"""Organization, team, project, and storage request schemas."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.operations import ProjectStatus


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    slug: str | None = Field(default=None, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    country: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=64)
    sector_ids: list[UUID] | None = None


class SettingsUpdate(BaseModel):
    timezone: str | None = None
    country: str | None = None
    default_language: str | None = None
    retention_days: int | None = Field(default=None, ge=1, le=3650)
    export_reason_required: bool | None = None
    notification_preferences: dict[str, object] | None = None


class SectorAssignmentRequest(BaseModel):
    sector_ids: list[UUID]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    organization_sector_id: UUID
    description: str = ""
    country: str | None = None
    status: ProjectStatus = ProjectStatus.DRAFT
    start_date: date | None = None
    end_date: date | None = None
    target_sample_size: int | None = Field(default=None, ge=1)
    is_private: bool = False


class LocationCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    level: str = Field(default="site", max_length=80)
    parent_id: UUID | None = None


class AssignmentCreate(BaseModel):
    membership_id: UUID
    project_id: UUID
    location_id: UUID | None = None
    daily_target: int = Field(default=0, ge=0)
    effective_from: date | None = None
    effective_to: date | None = None


class UploadIntentRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(pattern=r"^image/(png|jpeg|webp)$")
    size_bytes: int = Field(gt=0, le=5_000_000)
