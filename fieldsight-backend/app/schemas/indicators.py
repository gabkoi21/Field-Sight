"""Validation models for the project-level M&E indicator register."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

IndicatorUnitValue = Literal["number", "percentage", "rate", "ratio", "currency", "days", "text"]
IndicatorDirectionValue = Literal["increase", "decrease"]
IndicatorStatusValue = Literal["on_track", "needs_attention", "not_started"]
ReportingFrequency = Literal["weekly", "monthly", "quarterly", "semi_annual", "annual"]
IndicatorCalculationValue = Literal["count_records", "count_matching", "percentage_matching", "sum", "average"]


class IndicatorFieldRead(BaseModel):
    source_field: str
    label: str


class IndicatorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    description: str | None = Field(default=None, max_length=1000)
    unit: IndicatorUnitValue = "number"
    direction: IndicatorDirectionValue = "increase"
    baseline_value: float | None = None
    target_value: float | None = None
    target_date: date | None = None
    reporting_frequency: ReportingFrequency = "monthly"
    mapping: "IndicatorMappingWrite | None" = None

    @model_validator(mode="after")
    def validate_target(self) -> "IndicatorCreate":
        if self.target_date is not None and self.target_value is None:
            raise ValueError("A target value is required when a target date is set.")
        return self


class IndicatorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    code: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    description: str | None = Field(default=None, max_length=1000)
    unit: IndicatorUnitValue | None = None
    direction: IndicatorDirectionValue | None = None
    baseline_value: float | None = None
    target_value: float | None = None
    target_date: date | None = None
    reporting_frequency: ReportingFrequency | None = None
    is_active: bool | None = None


class IndicatorRead(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    code: str
    description: str | None
    unit: IndicatorUnitValue
    direction: IndicatorDirectionValue
    baseline_value: float | None
    target_value: float | None
    target_date: date | None
    reporting_frequency: ReportingFrequency
    status: IndicatorStatusValue
    is_active: bool
    mapping: "IndicatorMappingRead | None" = None
    current_value: float | None = None
    eligible_records: int = 0
    mapped_records: int = 0
    history: list["IndicatorResultPoint"] = []
    location_breakdown: list["IndicatorLocationResult"] = []
    created_at: datetime
    updated_at: datetime


class IndicatorMappingWrite(BaseModel):
    source_field: str = Field(min_length=1, max_length=255)
    calculation: IndicatorCalculationValue
    match_value: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_match_value(self) -> "IndicatorMappingWrite":
        if self.calculation in {"count_matching", "percentage_matching"} and not self.match_value:
            raise ValueError("A matching answer is required for this calculation.")
        return self


class IndicatorMappingRead(IndicatorMappingWrite):
    id: UUID
    indicator_id: UUID


class IndicatorResultPoint(BaseModel):
    period: str
    value: float | None
    eligible_records: int
    mapped_records: int


class IndicatorLocationResult(BaseModel):
    location: str
    value: float | None
    eligible_records: int
    mapped_records: int


IndicatorRead.model_rebuild()
IndicatorCreate.model_rebuild()
