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
    numerator: float | None = Field(default=None, ge=0, le=1e15)
    denominator: float | None = Field(default=None, gt=0, le=1e15)
    narrative: str | None = Field(default=None, min_length=1, max_length=4000)
    location: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def result_required(self) -> "CollectedResultInput":
        if (self.numerator is None) != (self.denominator is None):
            raise ValueError("Enter both numerator and denominator.")
        if self.value is None and self.numerator is None and not (self.narrative or "").strip():
            raise ValueError("Enter a numeric result or a qualitative narrative.")
        return self


class DashboardWidget(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    title: str = Field(min_length=1, max_length=200)
    kind: Literal["indicator", "analysis", "text"]
    source_id: UUID | None = None
    text: str = Field(default="", max_length=4000)
    width: Literal[1, 2] = 1
    height: int = Field(default=360, ge=240, le=900)

    @model_validator(mode="after")
    def valid_source(self) -> "DashboardWidget":
        if self.kind == "text" and self.source_id is not None:
            raise ValueError("Text widgets cannot reference a data source.")
        if self.kind != "text" and self.source_id is None:
            raise ValueError("Choose a source for this widget.")
        return self


class DashboardInput(BaseModel):
    # Older clients submit read-only fields back with a full dashboard PUT.
    model_config = ConfigDict(extra="ignore")
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=1000)
    project_id: UUID
    widgets: list[DashboardWidget] = Field(default_factory=list, max_length=30)
    date_from: date | None = None
    date_to: date | None = None
    version: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def ordered_dates(self) -> "DashboardInput":
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("Start date must be on or before end date.")
        return self
