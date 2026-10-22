"""Validated query specifications and aggregate-only survey results."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

FieldType = Literal["select_one", "select_multiple", "number", "date", "text", "geopoint", "repeat"]
Measure = Literal["auto", "count", "sum", "average", "min", "max"]


class Choice(BaseModel):
    value: str
    label: str


class SurveyField(BaseModel):
    source_field: str
    label: str
    type: FieldType
    choices: list[Choice] = Field(default_factory=list)
    source: Literal["kobo", "mapping", "inferred"] = "inferred"
    supported: bool = True


class SurveyCatalogue(BaseModel):
    project_id: UUID
    form_id: str | None
    form_name: str | None
    form_version: str | None = None
    fields: list[SurveyField]
    forms: list[str]
    locations: list[str]
    enumerators: list[str]
    schema_updated_at: datetime | None = None
    warning: str | None = None


class AnalysisFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date_from: date | None = None
    date_to: date | None = None
    location: str | None = Field(default=None, max_length=255)
    enumerator: str | None = Field(default=None, max_length=255)
    review_status: Literal["ready", "needs_review", "invalid", "all"] = "ready"
    categories: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def ordered_dates(self) -> "AnalysisFilters":
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("Start date must be on or before end date.")
        return self


class AnalysisQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: UUID
    form_id: str | None = Field(default=None, max_length=255)
    source_field: str = Field(min_length=1, max_length=255)
    measure: Measure = "auto"
    group_by: str | None = Field(default=None, max_length=255)
    time_grain: Literal["day", "month", "year"] = "day"
    filters: AnalysisFilters = Field(default_factory=AnalysisFilters)


class AnalysisPoint(BaseModel):
    name: str
    group: str | None = None
    value: float | None
    count: int
    percent: float | None = None


class AnalysisResult(BaseModel):
    project_id: UUID
    form_id: str | None
    field: SurveyField
    measure: str
    total_records: int
    eligible_records: int
    answered_records: int
    missing_records: int
    invalid_answers: int
    denominator: int
    value: float | None
    series: list[AnalysisPoint]
    filters: AnalysisFilters
    group_by: str | None
    note: str
    generated_at: datetime


class SavedAnalysisInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    query: AnalysisQuery
    chart: Literal["bar", "line", "donut", "table"] = "bar"


class SavedAnalysisRead(SavedAnalysisInput):
    id: UUID
    created_at: datetime
