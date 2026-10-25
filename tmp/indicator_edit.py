from pathlib import Path
p=Path('fieldsight-backend/app/models/operations.py')
s=p.read_text().replace('    manual_aggregation: str = "legacy"','    definition_version: int = 0\n    reliability_policy: int = 0\n    manual_aggregation: str = "legacy"')
s += '''\n\nclass IndicatorDefinitionVersion(SQLModel, table=True):
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
'''
p.write_text(s)
p=Path('fieldsight-backend/app/schemas/indicators.py');s=p.read_text().replace('Literal["legacy", "unweighted_mean", "pooled"]','Literal["legacy", "unweighted_mean", "pooled", "sum", "latest"]')
s=s.replace('    mapping: "IndicatorMappingWrite | None" = None','    is_active: bool = False\n    mapping: "IndicatorMappingWrite | None" = None',1)
s=s.replace('    manual_mean_confirmed: bool | None = None','    change_reason: str | None = Field(default=None, min_length=3, max_length=1000)\n    confirm_change: bool = False\n    expected_version: int | None = None\n    manual_mean_confirmed: bool | None = None',1)
s=s.replace('class IndicatorRead(BaseModel):','class IndicatorRead(BaseModel):\n    definition_version: int = 0\n    reliability_policy: int = 0\n    legacy_definition: bool = False\n    setup_complete: bool = False\n    definition_warnings: list[str] = Field(default_factory=list)')
s=s.replace('    source_field: str = Field(min_length=1, max_length=255)','    change_reason: str | None = Field(default=None, min_length=3, max_length=1000)\n    confirm_change: bool = False\n    expected_version: int | None = None\n    source_field: str = Field(min_length=1, max_length=255)')
p.write_text(s)
