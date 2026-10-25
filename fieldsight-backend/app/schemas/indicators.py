"""Validation models for the project-level M&E indicator register."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.analysis import Choice, FieldType

IndicatorUnitValue = Literal["number", "percentage", "rate", "ratio", "currency", "days", "text"]
IndicatorDirectionValue = Literal["increase", "decrease"]
IndicatorStatusValue = Literal["on_track", "needs_attention", "not_started", "in_progress"]
ReportingFrequency = Literal["weekly", "monthly", "quarterly", "semi_annual", "annual"]
IndicatorCalculationValue = Literal["count_records", "count_matching", "percentage_matching", "sum", "average"]


class IndicatorFieldRead(BaseModel):
    source_field: str
    label: str
    type: FieldType = "text"
    choices: list[Choice] = Field(default_factory=list)
    form_id: str | None = None
    supported: bool = True


class IndicatorCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str = Field(min_length=2, max_length=200)
    code: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    description: str | None = Field(default=None, max_length=1000)
    unit: IndicatorUnitValue = "number"
    manual_mean_confirmed: bool = False
    manual_aggregation: Literal["legacy", "unweighted_mean", "pooled", "sum", "latest"] = "legacy"
    manual_rate_multiplier: float = Field(default=1, gt=0, le=1e6)
    direction: IndicatorDirectionValue = "increase"
    baseline_value: float | None = None
    target_value: float | None = None
    target_date: date | None = None
    reporting_frequency: ReportingFrequency = "monthly"
    framework_node_id: UUID | None = None
    is_active: bool = False
    mapping: "IndicatorMappingWrite | None" = None

    @model_validator(mode="after")
    def validate_target(self) -> "IndicatorCreate":
        if self.target_date is not None and self.target_value is None:
            raise ValueError("A target value is required when a target date is set.")
        return self


class IndicatorUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    name: str | None = Field(default=None, min_length=2, max_length=200)
    code: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
    description: str | None = Field(default=None, max_length=1000)
    unit: IndicatorUnitValue | None = None
    change_reason: str | None = Field(default=None, min_length=3, max_length=1000)
    confirm_change: bool = False
    expected_version: int | None = None
    manual_mean_confirmed: bool | None = None
    manual_aggregation: Literal["legacy", "unweighted_mean", "pooled", "sum", "latest"] | None = None
    manual_rate_multiplier: float | None = Field(default=None, gt=0, le=1e6)
    direction: IndicatorDirectionValue | None = None
    baseline_value: float | None = None
    target_value: float | None = None
    target_date: date | None = None
    reporting_frequency: ReportingFrequency | None = None
    is_active: bool | None = None
    framework_node_id: UUID | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "IndicatorUpdate":
        required = {"name", "code", "unit", "direction", "reporting_frequency", "is_active", "manual_mean_confirmed"}
        required |= {"manual_aggregation", "manual_rate_multiplier"}
        for key in required & self.model_fields_set:
            if getattr(self, key) is None:
                raise ValueError(f"{key} cannot be null.")
        return self


class IndicatorRead(BaseModel):
    definition_version: int = 0
    reliability_policy: int = 0
    legacy_definition: bool = False
    setup_complete: bool = False
    definition_warnings: list[str] = Field(default_factory=list)
    manual_aggregation: Literal["legacy", "unweighted_mean", "pooled", "sum", "latest"] = "legacy"
    manual_rate_multiplier: float = 1
    manual_mean_confirmed: bool = False
    result_source: Literal["table", "manual", "unconfigured"] = "unconfigured"
    qualitative_value: str | None = None
    manual_result_count: int = 0
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
    framework_node_id: UUID | None = None
    mapping: "IndicatorMappingRead | None" = None
    current_value: float | None = None
    eligible_records: int = 0
    mapped_records: int = 0
    numerator: float | None = None
    denominator: int | float = 0
    missing_records: int = 0
    invalid_answers: int = 0
    quality_excluded_records: int = 0
    undated_records: int = 0
    target_achieved: bool | None = None
    progress_percent: float | None = None
    schedule_status: Literal["achieved", "not_due", "overdue", "no_deadline", "no_target", "no_data"] = "no_data"
    mapping_health: Literal["unmapped", "healthy", "field_missing", "form_missing", "unsupported", "type_mismatch"] = (
        "unmapped"
    )
    calculation_note: str = ""
    source_form_id: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    history: list["IndicatorResultPoint"] = []
    location_breakdown: list["IndicatorLocationResult"] = []
    created_at: datetime
    updated_at: datetime


class IndicatorMappingWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    change_reason: str | None = Field(default=None, min_length=3, max_length=1000)
    confirm_change: bool = False
    expected_version: int | None = None
    source_field: str = Field(min_length=1, max_length=255)
    source_form_id: str | None = Field(default=None, max_length=255)
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
    numerator: float | None = None
    denominator: int | float = 0
    missing_records: int = 0
    invalid_answers: int = 0
    target_value: float | None = None
    target_achieved: bool | None = None


class IndicatorLocationResult(BaseModel):
    location: str
    value: float | None
    eligible_records: int
    mapped_records: int
    numerator: float | None = None
    denominator: int | float = 0


FrameworkType = Literal["goal", "objective", "outcome", "output", "activity"]


class FrameworkNodeInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=2, max_length=300)
    node_type: FrameworkType = "outcome"
    parent_id: UUID | None = None
    sort_order: int = Field(default=0, ge=0, le=10000)


class FrameworkNodeRead(FrameworkNodeInput):
    id: UUID
    project_id: UUID
    created_at: datetime


class IndicatorPeriodTargetInput(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    period: str = Field(min_length=4, max_length=16)
    target_value: float


IndicatorRead.model_rebuild()
IndicatorCreate.model_rebuild()
