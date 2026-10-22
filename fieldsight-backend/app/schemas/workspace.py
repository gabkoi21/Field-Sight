"""Bounded inputs for workspace quick-start workflows."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class InvitationInput(BaseModel):
    email: EmailStr
    role: Literal["organization_admin", "enumerator"] = "enumerator"


class AcceptInvitation(BaseModel):
    token: str = Field(min_length=30, max_length=200)
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class MemberInput(BaseModel):
    role: Literal["organization_admin", "enumerator"]
    is_active: bool


class PreferenceInput(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    landing_page: Literal["/", "/projects", "/indicators", "/dashboards", "/guide"] = "/projects"


class PasswordInput(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TeamAssignmentInput(BaseModel):
    membership_id: UUID


class TableImportInput(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    csv_text: str = Field(min_length=1, max_length=1_000_000)
    date_column: str | None = Field(default=None, max_length=200)
    location_column: str | None = Field(default=None, max_length=200)


class CollectedResultInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    result_date: date
    value: float | None = None
    narrative: str | None = Field(default=None, min_length=1, max_length=4000)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def result_required(self) -> "CollectedResultInput":
        if self.value is None and not (self.narrative or "").strip():
            raise ValueError("Enter a numeric result or a qualitative narrative.")
        return self


class DashboardWidget(BaseModel):
    id: UUID
    title: str = Field(min_length=1, max_length=200)
    kind: Literal["indicator", "analysis", "text"]
    source_id: UUID | None = None
    text: str = Field(default="", max_length=4000)
    width: Literal[1, 2] = 1


class DashboardInput(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=1000)
    project_id: UUID
    widgets: list[DashboardWidget] = Field(default_factory=list, max_length=30)
