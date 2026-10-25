"""Explicit, separate aggregation of manually entered collected results."""

from collections.abc import Sequence
from datetime import UTC, date, datetime
from math import fsum, isfinite

from app.core.indicator_results import Calculation, calculate, read_result
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
    rows = sorted(rows, key=lambda row: (row.result_date, row.created_at.replace(tzinfo=UTC), str(row.id)))
    eligible = [r for r in rows if (not start or r.result_date >= start) and (not end or r.result_date <= end)]
    records = [
        Submission(
            organization_id=indicator.organization_id,
            project_id=indicator.project_id,
            kobo_connection_id=indicator.created_by_id,
            kobo_form_id="manual",
            id=row.id,
            created_at=row.created_at,
            external_id=str(row.id),
            submitted_at=datetime.combine(row.result_date, datetime.min.time(), tzinfo=UTC),
            location=row.location,
            raw_answers={"value": row.value, "numerator": row.numerator, "denominator": row.denominator},
            review_status="ready",
        )
        for row in eligible
    ]
    operation = (
        IndicatorCalculation.AVERAGE
        if indicator.manual_aggregation == "unweighted_mean"
        or (indicator.manual_aggregation == "legacy" and indicator.unit in {"percentage", "rate", "ratio"})
        else IndicatorCalculation.SUM
    )
    mapping = IndicatorMapping(
        organization_id=indicator.organization_id,
        project_id=indicator.project_id,
        indicator_id=indicator.id,
        source_field="value",
        calculation=operation,
    )
    field = SurveyField(source_field="value", label="Manual result", type="number")

    def pooled(_mapping: IndicatorMapping | None, items: list[Submission], _field: SurveyField | None) -> Calculation:
        from app.core.survey import number

        result = Calculation(eligible_records=len(items))
        numerators, denominators = [], []
        for item in items:
            numerator = number(item.raw_answers.get("numerator"))
            denominator = number(item.raw_answers.get("denominator"))
            if numerator is None or denominator is None:
                result.missing_records += 1
            elif numerator < 0 or denominator <= 0 or (indicator.unit == "percentage" and numerator > denominator):
                result.invalid_answers += 1
            else:
                numerators.append(numerator)
                denominators.append(denominator)
        result.mapped_records = len(numerators)
        result.numerator = fsum(numerators) if numerators else None
        result.denominator = fsum(denominators)
        scale = (
            100
            if indicator.unit == "percentage"
            else indicator.manual_rate_multiplier
            if indicator.unit == "rate"
            else 1
        )
        if result.numerator is not None and result.denominator:
            value = result.numerator / result.denominator * scale
            result.value = round(value, 2) if isfinite(value) else None
        return result

    def latest(mapping: IndicatorMapping | None, items: list[Submission], field: SurveyField | None) -> Calculation:
        result = calculate(mapping, items, field)
        valid = [item for item in items if isinstance(item.raw_answers.get("value"), (int, float))]
        if valid:
            chosen = max(valid, key=lambda item: (item.submitted_at, item.created_at.replace(tzinfo=UTC), str(item.id)))
            from app.core.survey import number

            result.value = number(chosen.raw_answers["value"])
            result.numerator = result.value
            result.denominator = 1
        return result

    use_pool = indicator.manual_aggregation == "pooled" and indicator.unit in {"percentage", "rate", "ratio"}
    result = read_result(
        indicator,
        mapping,
        records,
        field,
        None,
        "healthy",
        start,
        end,
        period_targets=targets,
        calculator=pooled if use_pool else latest if indicator.manual_aggregation == "latest" else calculate,
    )
    result.mapping = None
    result.result_source = "manual"
    result.manual_result_count = len(eligible)
    result.manual_mean_confirmed = indicator.manual_mean_confirmed
    result.calculation_note = (
        "Manually entered results only; linked table records are not combined. "
        + (
            "Percentages, rates and ratios use the unweighted mean of entered results. "
            if operation == "average"
            else "Numeric results are summed. "
        )
        + "Reporting periods use each result's date."
    )
    if operation == "average":
        result.calculation_note += (
            " Explicitly selected by an administrator."
            if indicator.manual_mean_confirmed or indicator.manual_aggregation == "unweighted_mean"
            else " Legacy behavior retained; confirm this method in indicator settings."
        )
        result.calculation_note += (
            " Each entered value has equal weight, regardless of population size; this is not a pooled percentage."
            " For pooled results, map a percentage calculation to individual source records instead."
        )
    if use_pool:
        scale = (
            100
            if indicator.unit == "percentage"
            else indicator.manual_rate_multiplier
            if indicator.unit == "rate"
            else 1
        )
        result.calculation_note = (
            f"Pooled manual results: sum(numerator) / sum(denominator) × {scale:g}. "
            "The same method is applied independently to each reporting period and location. "
            "Manual results are separate from linked submissions."
        )
    if indicator.manual_aggregation == "latest":
        result.calculation_note = (
            "Latest observation ordered by result date, creation timestamp, then record UUID. "
            "Periods are independent; manual results only."
        )
    if indicator.unit == "text":
        result.qualitative_value = eligible[-1].narrative if eligible else None
        result.mapped_records = sum(bool((row.narrative or "").strip()) for row in eligible)
        result.missing_records = len(eligible) - result.mapped_records
        result.invalid_answers = 0
        result.current_value = result.progress_percent = result.target_achieved = None
        result.history = []
        result.location_breakdown = []
        result.schedule_status = "no_target" if eligible else "no_data"
        result.status = "in_progress" if eligible else "not_started"
        result.calculation_note = "Latest qualitative narrative in the selected date window; no numeric aggregation."
    return result
