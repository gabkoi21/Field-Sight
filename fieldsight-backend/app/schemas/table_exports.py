"""Validated, reproducible period-report options."""

from datetime import date
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, model_validator


class TableExportInput(BaseModel):
    format: Literal["xlsx", "csv", "json", "pdf"] = "xlsx"
    period: Literal["weekly", "fortnightly", "monthly", "custom", "all"] = "monthly"
    anchor: date
    end: date | None = None
    week_start: int = Field(default=0, ge=0, le=6)
    timezone: str = "UTC"
    date_field: str | None = None
    content: Literal["summary", "records", "both"] = "both"
    compare: bool = True
    group_by: Literal["week", "location", "submitter", "county"] = "week"
    county: str | None = Field(default=None, max_length=80)
    county_field: str | None = None
    columns: list[str] | None = Field(default=None, max_length=1000)
    review_status: Literal["all", "ready", "needs_review", "invalid"] = "all"
    search: str = Field(default="", max_length=200)
    metric_field: str | None = None
    metric: Literal["sum", "average"] = "sum"

    @model_validator(mode="after")
    def valid_period(self):
        try:
            ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Choose a valid reporting timezone.") from exc
        if self.period == "custom" and (self.end is None or self.end < self.anchor):
            raise ValueError("Custom end date must be on or after the start date.")
        if self.period != "all" and not date(1900, 1, 1) <= self.anchor <= date(9998, 1, 1):
            raise ValueError("Reporting date must be between 1900 and 9998.")
        if self.end and self.end > date(9998, 1, 1):
            raise ValueError("End date must be before 9998.")
        return self


class TableScheduleInput(BaseModel):
    options: TableExportInput

    @model_validator(mode="after")
    def recurring_only(self):
        if self.options.period not in ("weekly", "fortnightly", "monthly"):
            raise ValueError("Schedules require weekly, every-two-weeks, or monthly periods.")
        return self
