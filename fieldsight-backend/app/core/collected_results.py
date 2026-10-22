"""Explicit, separate aggregation of manually entered collected results."""

from collections.abc import Sequence
from datetime import UTC, date, datetime

from app.core.indicator_results import read_result
from app.models.operations import Indicator, IndicatorCalculation, IndicatorMapping, Submission
from app.models.workspace import CollectedResult
from app.schemas.analysis import SurveyField
from app.schemas.indicators import IndicatorRead


def manual_result(
    indicator: Indicator,
    rows: Sequence[CollectedResult],
    targets: dict[str, float],
    start: date | None,
    end: date | None,
) -> IndicatorRead:
    eligible = [r for r in rows if (not start or r.result_date >= start) and (not end or r.result_date <= end)]
    records = [
        Submission(
            organization_id=indicator.organization_id,
            project_id=indicator.project_id,
            kobo_connection_id=indicator.created_by_id,
            kobo_form_id="manual",
            external_id=str(row.id),
            submitted_at=datetime.combine(row.result_date, datetime.min.time(), tzinfo=UTC),
            location=row.location,
            raw_answers={"value": row.value},
            review_status="ready",
        )
        for row in eligible
    ]
    operation = (
        IndicatorCalculation.AVERAGE if indicator.unit in {"percentage", "rate", "ratio"} else IndicatorCalculation.SUM
    )
    mapping = IndicatorMapping(
        organization_id=indicator.organization_id,
        project_id=indicator.project_id,
        indicator_id=indicator.id,
        source_field="value",
        calculation=operation,
    )
    field = SurveyField(source_field="value", label="Manual result", type="number")
    result = read_result(indicator, mapping, records, field, None, "healthy", start, end, period_targets=targets)
    result.mapping = None
    result.result_source = "manual"
    result.manual_result_count = len(eligible)
    result.calculation_note = (
        "Manually entered results only; linked table records are not combined. "
        + (
            "Percentages, rates and ratios use the unweighted mean of entered results. "
            if operation == "average"
            else "Numeric results are summed. "
        )
        + "Reporting periods use each result's date."
    )
    if indicator.unit == "text":
        result.qualitative_value = eligible[-1].narrative if eligible else None
        result.current_value = result.progress_percent = result.target_achieved = None
        result.history = []
        result.location_breakdown = []
        result.schedule_status = "no_target" if eligible else "no_data"
        result.status = "in_progress" if eligible else "not_started"
        result.calculation_note = "Latest qualitative narrative in the selected date window; no numeric aggregation."
    return result
