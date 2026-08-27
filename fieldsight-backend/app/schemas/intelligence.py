"""Validation models for project intelligence resources."""

from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

DataType = Literal["text", "number", "date", "boolean", "single_select", "multiple_select", "gps", "location"]


class FieldMappingWrite(BaseModel):
    source_field: str = Field(min_length=1, max_length=255)
    display_name: str = Field(min_length=1, max_length=200)
    meaning: str | None = Field(default=None, max_length=200)
    data_type: DataType = "text"
    is_required: bool = False
    is_location: bool = False


class FieldMappingRead(FieldMappingWrite):
    id: UUID
    project_id: UUID


class FieldMappingOverview(BaseModel):
    mappings: list[FieldMappingRead]
    source_fields: list[str]


class ProjectTargetCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    target_value: float = Field(gt=0)
    unit: str = Field(default="records", min_length=1, max_length=80)
    direction: Literal["at_least", "at_most"] = "at_least"
    field_mapping_id: UUID | None = None
    due_date: date | None = None


class ProjectTargetRead(ProjectTargetCreate):
    id: UUID
    project_id: UUID


class ProjectTargetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    target_value: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=80)
    direction: Literal["at_least", "at_most"] | None = None
    field_mapping_id: UUID | None = None
    due_date: date | None = None
