"""Field operations: projects, settings, locations, Kobo connections, submissions, and assignments."""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.identity import utc_now


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    IN_REVIEW = "in_review"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class IndicatorUnit(StrEnum):
    NUMBER = "number"
    PERCENTAGE = "percentage"
    RATE = "rate"
    RATIO = "ratio"
    CURRENCY = "currency"
    DAYS = "days"
    TEXT = "text"


class IndicatorDirection(StrEnum):
    INCREASE = "increase"
    DECREASE = "decrease"


class IndicatorStatus(StrEnum):
    ON_TRACK = "on_track"
    NEEDS_ATTENTION = "needs_attention"
    NOT_STARTED = "not_started"


class IndicatorCalculation(StrEnum):
    COUNT_RECORDS = "count_records"
    COUNT_MATCHING = "count_matching"
    PERCENTAGE_MATCHING = "percentage_matching"
    SUM = "sum"
    AVERAGE = "average"


class OrganizationSettings(SQLModel, table=True):
    __tablename__ = "organization_settings"
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), primary_key=True))
    timezone: str = "UTC"
    country: str | None = None
    default_language: str = "en"
    retention_days: int = 365
    export_reason_required: bool = False
    notification_preferences: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_project_org_name"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    organization_sector_id: UUID = Field(
        sa_column=Column(ForeignKey("organization_sectors.id"), index=True, nullable=False)
    )
    name: str = Field(sa_column=Column(String(200), nullable=False))
    description: str = ""
    workspace_details: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    country: str | None = None
    status: ProjectStatus = ProjectStatus.DRAFT
    start_date: date | None = None
    end_date: date | None = None
    target_sample_size: int | None = None
    is_private: bool = False
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    kobo_connection_id: UUID | None = Field(
        default=None, sa_column=Column(ForeignKey("kobo_connections.id"), nullable=True)
    )
    kobo_form_id: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    kobo_form_name: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))


class OrganizationAdminEvent(SQLModel, table=True):
    __tablename__ = "organization_admin_events"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    actor_id: UUID = Field(foreign_key="users.id")
    action: str
    resource_id: str
    occurred_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SyncWorkerHeartbeat(SQLModel, table=True):
    __tablename__ = "sync_worker_heartbeats"
    worker_id: str = Field(primary_key=True)
    last_seen_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SyncSchedule(SQLModel, table=True):
    __tablename__ = "sync_schedules"
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), primary_key=True))
    mode: str = "manual"
    interval_minutes: int = 60
    interval_seconds: float | None = None
    next_due_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_by_id: UUID | None = Field(default=None, foreign_key="users.id")
    updated_at: datetime = Field(default_factory=utc_now)


class SyncSettingsChange(SQLModel, table=True):
    __tablename__ = "sync_settings_changes"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    project_id: UUID = Field(foreign_key="projects.id", index=True)
    changed_by_id: UUID = Field(foreign_key="users.id")
    mode: str
    interval_minutes: int
    interval_seconds: float | None = None
    changed_at: datetime = Field(default_factory=utc_now)


class SyncJob(SQLModel, table=True):
    __tablename__ = "sync_jobs"
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), primary_key=True))
    trigger: str = "manual"
    requested_by_id: UUID | None = Field(default=None, foreign_key="users.id")
    attempts: int = 0
    due_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    created_at: datetime = Field(default_factory=utc_now)


class Location(SQLModel, table=True):
    __tablename__ = "locations"
    __table_args__ = (UniqueConstraint("organization_id", "code", name="uq_location_org_code"),)
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    parent_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("locations.id")))
    code: str
    name: str
    level: str = "site"
    is_active: bool = True


class KoboConnection(SQLModel, table=True):
    __tablename__ = "kobo_connections"
    __table_args__ = (UniqueConstraint("organization_id", "name", name="uq_kobo_connection_org_name"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    name: str = Field(sa_column=Column(String(120), nullable=False))
    server_url: str = Field(sa_column=Column(String(255), nullable=False))
    token_encrypted: str = Field(sa_column=Column(String, nullable=False))
    selected_form_id: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    selected_form_name: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    is_verified: bool = Field(default=False, nullable=False)
    is_deleted: bool = Field(default=False, nullable=False)
    verified_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SyncRun(SQLModel, table=True):
    __tablename__ = "sync_runs"
    __table_args__ = (Index("ix_sync_runs_org_project_started_at", "organization_id", "project_id", "started_at"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    kobo_connection_id: UUID = Field(sa_column=Column(ForeignKey("kobo_connections.id"), nullable=False))
    kobo_form_id: str = Field(sa_column=Column(String(255), nullable=False))
    status: str = Field(default="completed", sa_column=Column(String(32), nullable=False))
    trigger: str = "manual"
    requested_by_id: UUID | None = Field(default=None, foreign_key="users.id")
    attempt: int = 1
    failed_count: int = 0
    received_count: int = 0
    created_count: int = 0
    updated_count: int = 0
    error_message: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    started_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    completed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))


class Submission(SQLModel, table=True):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("project_id", "kobo_form_id", "external_id", name="uq_submission_project_form_external_id"),
        Index("ix_submissions_org_submitted_at", "organization_id", "submitted_at"),
        Index("ix_submissions_org_project_submitted_at", "organization_id", "project_id", "submitted_at"),
        Index("ix_submissions_org_review_submitted_at", "organization_id", "review_status", "submitted_at"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    kobo_connection_id: UUID = Field(sa_column=Column(ForeignKey("kobo_connections.id"), nullable=False))
    kobo_form_id: str = Field(sa_column=Column(String(255), nullable=False))
    external_id: str = Field(sa_column=Column(String(255), nullable=False))
    submitted_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    enumerator: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    location: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    review_status: str = Field(default="ready", sa_column=Column(String(32), nullable=False))
    evidence_fingerprint: str | None = None
    decision_fingerprint: str | None = None
    decision_status: str | None = None
    review_required: bool = False
    validation_status: str | None = None
    reviewer_id: UUID | None = Field(default=None, foreign_key="users.id")
    raw_answers: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class QualityFinding(SQLModel, table=True):
    __tablename__ = "quality_findings"
    id: str = Field(primary_key=True)
    submission_id: UUID = Field(sa_column=Column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True))
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id", ondelete="CASCADE"), index=True))
    severity: str = Field(index=True)
    rule: str
    detail: str
    field: str | None = None
    detected_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SubmissionReviewEvent(SQLModel, table=True):
    __tablename__ = "submission_review_events"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    submission_id: UUID = Field(sa_column=Column(ForeignKey("submissions.id", ondelete="CASCADE"), index=True))
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    actor_id: UUID | None = Field(default=None, foreign_key="users.id")
    source: str = "administrator"
    evidence_fingerprint: str | None = None
    previous_evidence_fingerprint: str | None = None
    action: str
    previous_status: str | None = None
    status: str | None = None
    reviewer_id: UUID | None = Field(default=None, foreign_key="users.id")
    note: str | None = None
    occurred_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class FieldMapping(SQLModel, table=True):
    __tablename__ = "field_mappings"
    __table_args__ = (UniqueConstraint("project_id", "source_field", name="uq_field_mapping_project_source"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    source_field: str = Field(sa_column=Column(String(255), nullable=False))
    display_name: str = Field(sa_column=Column(String(200), nullable=False))
    meaning: str | None = Field(default=None, sa_column=Column(String(200), nullable=True))
    data_type: str = Field(default="text", sa_column=Column(String(32), nullable=False))
    is_required: bool = False
    is_location: bool = False
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SurveySchema(SQLModel, table=True):
    __tablename__ = "survey_schemas"
    __table_args__ = (UniqueConstraint("project_id", "form_id", name="uq_survey_schema_project_form"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), nullable=False, index=True))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), nullable=False, index=True))
    form_id: str = Field(sa_column=Column(String(255), nullable=False))
    version: str | None = None
    fields_json: list[dict[str, object]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class SavedAnalysis(SQLModel, table=True):
    __tablename__ = "saved_analyses"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), nullable=False, index=True))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), nullable=False, index=True))
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    title: str = Field(sa_column=Column(String(200), nullable=False))
    query_json: dict[str, object] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    chart: str = "bar"
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class ProjectTarget(SQLModel, table=True):
    __tablename__ = "project_targets"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    field_mapping_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("field_mappings.id")))
    name: str = Field(sa_column=Column(String(200), nullable=False))
    target_value: float
    unit: str = Field(default="records", sa_column=Column(String(80), nullable=False))
    direction: str = Field(default="at_least", sa_column=Column(String(20), nullable=False))
    due_date: date | None = None
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class ResultFrameworkNode(SQLModel, table=True):
    __tablename__ = "result_framework_nodes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), nullable=False, index=True))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), nullable=False, index=True))
    parent_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("result_framework_nodes.id")))
    title: str = Field(sa_column=Column(String(300), nullable=False))
    node_type: str = Field(default="outcome", sa_column=Column(String(32), nullable=False))
    sort_order: int = 0
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class Indicator(SQLModel, table=True):
    """Project-scoped M&E indicator definition.

    Current values are deliberately not stored here: a later calculation layer will
    derive them from mapped, quality-approved Kobo submissions.
    """

    __tablename__ = "indicators"
    __table_args__ = (
        UniqueConstraint("project_id", "code", name="uq_indicator_project_code"),
        Index("ix_indicators_org_project_active", "organization_id", "project_id", "is_active"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    created_by_id: UUID = Field(sa_column=Column(ForeignKey("users.id"), nullable=False))
    name: str = Field(sa_column=Column(String(200), nullable=False))
    code: str = Field(sa_column=Column(String(80), nullable=False))
    description: str | None = Field(default=None, sa_column=Column(String(1000), nullable=True))
    unit: IndicatorUnit = Field(default=IndicatorUnit.NUMBER, sa_column=Column(String(32), nullable=False))
    direction: IndicatorDirection = Field(
        default=IndicatorDirection.INCREASE,
        sa_column=Column(String(32), nullable=False),
    )
    baseline_value: float | None = None
    manual_mean_confirmed: bool = False
    definition_version: int = 0
    reliability_policy: int = 0
    manual_aggregation: str = "legacy"
    manual_rate_multiplier: float = 1.0
    target_value: float | None = None
    target_date: date | None = None
    reporting_frequency: str = Field(default="monthly", sa_column=Column(String(32), nullable=False))
    framework_node_id: UUID | None = Field(
        default=None,
        sa_column=Column(ForeignKey("result_framework_nodes.id", name="fk_indicator_framework_node")),
    )
    status: IndicatorStatus = Field(default=IndicatorStatus.NOT_STARTED, sa_column=Column(String(32), nullable=False))
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class IndicatorPeriodTarget(SQLModel, table=True):
    __tablename__ = "indicator_period_targets"
    __table_args__ = (UniqueConstraint("indicator_id", "period", name="uq_indicator_period_target"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    indicator_id: UUID = Field(sa_column=Column(ForeignKey("indicators.id"), nullable=False, index=True))
    period: str = Field(sa_column=Column(String(16), nullable=False))
    target_value: float


class IndicatorMapping(SQLModel, table=True):
    """One deterministic Kobo answer mapping for an indicator."""

    __tablename__ = "indicator_mappings"
    __table_args__ = (UniqueConstraint("indicator_id", name="uq_indicator_mapping_indicator"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    indicator_id: UUID = Field(sa_column=Column(ForeignKey("indicators.id"), index=True, nullable=False))
    source_field: str = Field(sa_column=Column(String(255), nullable=False))
    source_form_id: str | None = Field(default=None, sa_column=Column(String(255)))
    calculation: IndicatorCalculation = Field(sa_column=Column(String(32), nullable=False))
    match_value: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class FieldAssignment(SQLModel, table=True):
    __tablename__ = "field_assignments"
    __table_args__ = (
        UniqueConstraint("organization_id", "membership_id", "project_id", "location_id", name="uq_assignment_scope"),
    )
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    organization_id: UUID = Field(sa_column=Column(ForeignKey("organizations.id"), index=True, nullable=False))
    membership_id: UUID = Field(sa_column=Column(ForeignKey("organization_memberships.id"), index=True, nullable=False))
    project_id: UUID = Field(sa_column=Column(ForeignKey("projects.id"), index=True, nullable=False))
    location_id: UUID | None = Field(default=None, sa_column=Column(ForeignKey("locations.id")))
    daily_target: int = 0
    effective_from: date | None = None
    effective_to: date | None = None
    is_enabled: bool = True
    created_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))


class IndicatorDefinitionVersion(SQLModel, table=True):
    """Observed changes only; definition history is not an immutable data snapshot."""
    __tablename__ = "indicator_definition_versions"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    indicator_id: UUID = Field(sa_column=Column(ForeignKey("indicators.id", ondelete="CASCADE"), index=True))
    organization_id: UUID = Field(foreign_key="organizations.id", index=True)
    actor_id: UUID = Field(foreign_key="users.id")
    version: int
    occurred_at: datetime = Field(default_factory=utc_now, sa_column=Column(DateTime(timezone=True), nullable=False))
    reason: str
    effective_scope: str = "current_definition_all_periods"
    previous_definition: dict = Field(sa_column=Column(JSON, nullable=False))
    new_definition: dict = Field(sa_column=Column(JSON, nullable=False))
    preview: dict = Field(sa_column=Column(JSON, nullable=False))
