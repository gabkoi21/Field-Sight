"""Strict report contracts. Narratives are plain text, never interpreted HTML."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.report_templates import TEMPLATES


class ReportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_key: Literal["monthly", "quarterly", "donor"]
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    reporting_period_start: date
    reporting_period_end: date
    sections: dict[str, str] = Field(default_factory=dict)
    indicator_ids: list[UUID] = Field(default_factory=list, max_length=500)

    @model_validator(mode="after")
    def validate_content(self) -> "ReportInput":
        if self.reporting_period_start > self.reporting_period_end:
            raise ValueError("Start date must be on or before end date.")
        allowed = TEMPLATES[self.template_key]["sections"]
        if set(self.sections) - set(allowed):
            raise ValueError("Unknown narrative section for this template.")
        if any(len(value) > 30000 for value in self.sections.values()):
            raise ValueError("Narrative sections must not exceed 30,000 characters.")
        if not self.title.strip():
            raise ValueError("A report title is required.")
        if len(set(self.indicator_ids)) != len(self.indicator_ids):
            raise ValueError("Duplicate indicator selection.")
        return self


class ReportUpdate(ReportInput):
    expected_revision: int = Field(ge=1)


class PublicationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=1)
    preview_hash: str = Field(pattern=r"^[a-f0-9]{64}$")


class ReportRead(ReportInput):
    id: UUID
    project_id: UUID
    organization_id: UUID
    status: Literal["draft", "published"]
    revision_number: int
    created_by_id: UUID
    updated_by_id: UUID
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None
    published_by_id: UUID | None


class ReportPage(BaseModel):
    items: list[ReportRead]
    total: int


class ReportPreview(BaseModel):
    data: dict
    content_hash: str
