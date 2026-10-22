"""Update schemas for tenant resources with lifecycle-aware deletion."""

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.operations import ProjectStatus


class WorkspaceDetailsInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    code: str = Field(default="", max_length=80)
    stage: str = Field(default="", max_length=100)
    countries: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default_factory=list, max_length=30)
    topics: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(default_factory=list, max_length=30)
    group: str = Field(default="", max_length=150)
    cost_unit: str = Field(default="", max_length=100)
    funding: str = Field(default="", max_length=300)
    health_status: Literal["", "red", "amber", "green"] = ""


class ProjectUpdate(BaseModel):
    workspace_details: WorkspaceDetailsInput | None = None
    name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    country: str | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    target_sample_size: int | None = Field(default=None, ge=1)
    is_private: bool | None = None


class LocationUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    level: str | None = Field(default=None, max_length=80)
    parent_id: UUID | None = None
    is_active: bool | None = None


class EnumeratorUpdate(BaseModel):
    is_active: bool | None = None
    phone_number: str | None = Field(default=None, max_length=32)
    gender: str | None = Field(default=None, max_length=32)
    date_of_birth: date | None = None
    address: str | None = Field(default=None, max_length=300)
    emergency_contact_name: str | None = Field(default=None, max_length=200)
    emergency_contact_phone: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=2000)


class AssignmentUpdate(BaseModel):
    daily_target: int | None = Field(default=None, ge=0)
    effective_from: date | None = None
    effective_to: date | None = None
    is_enabled: bool | None = None
