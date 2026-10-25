"""Deterministic M&E calculations over quality-approved stored submissions."""

from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Literal

from pydantic import BaseModel

from app.core.review_evidence import eligible as review_eligible
from app.core.survey import categories, flatten_answers, missing, number
from app.models.operations import Indicator, IndicatorMapping, Submission
from app.schemas.analysis import SurveyField
from app.schemas.indicators import IndicatorLocationResult, IndicatorRead, IndicatorResultPoint


class Calculation(BaseModel):
    value: float | None = None
    numerator: float | None = None
    denominator: int | float = 0
    eligible_records: int = 0
    mapped_records: int = 0
    missing_records: int = 0
    invalid_answers: int = 0
    quality_excluded_records: int = 0


def calculate(
    mapping: IndicatorMapping | None, records: list[Submission], field: SurveyField | None, unit: str | None = None
) -> Calculation:
    eligible = [record for record in records if review_eligible(record)]
    result = Calculation(eligible_records=len(eligible), quality_excluded_records=len(records) - len(eligible))
    if mapping is None or field is None or not field.supported:
        return result
    numbers: list[float] = []
    matches = 0
    numeric = mapping.calculation in {"sum", "average"}
    for record in eligible:
        answer = flatten_answers(record.raw_answers).get(mapping.source_field)
        if missing(answer):
            result.missing_records += 1
            continue
        if numeric:
            value = number(answer)
            if value is None or (unit == "percentage" and not 0 <= value <= 100):
                result.invalid_answers += 1
                continue
            numbers.append(value)
        else:
            values = categories(answer, field)
            if not values:
                result.invalid_answers += 1
                continue
            if any(value.casefold() == (mapping.match_value or "").casefold() for value in values):
                matches += 1
        result.mapped_records += 1
    result.denominator = result.mapped_records
    if not eligible:
        return result
    if mapping.calculation == "count_records":
        result.value = result.numerator = float(len(eligible))
        result.denominator = len(eligible)
    elif mapping.calculation == "count_matching":
        result.value = result.numerator = float(matches) if result.mapped_records else None
    elif mapping.calculation == "percentage_matching":
        result.numerator = float(matches)
        result.value = round(100 * matches / result.denominator, 2) if result.denominator else None
    elif numbers:
        # Average before summing avoids overflow for repeated large finite values.
        from math import isfinite

        total = sum(numbers)
        value = total if mapping.calculation == "sum" else sum(item / len(numbers) for item in numbers)
        result.numerator = total if isfinite(total) else None
        result.value = round(value, 2) if isfinite(value) else None
    return result


def period_key(record: Submission, frequency: str) -> str | None:
    timestamp = record.submitted_at
    if timestamp is None:
        return None
    day = (timestamp.replace(tzinfo=UTC) if timestamp.tzinfo is None else timestamp.astimezone(UTC)).date()
    return period_for_date(day, frequency)


def period_for_date(day: date, frequency: str) -> str:
    if frequency == "weekly":
        year, week, _ = day.isocalendar()
        return f"{year}-W{week:02d}"
    if frequency == "quarterly":
        return f"{day.year}-Q{(day.month - 1) // 3 + 1}"
    if frequency == "semi_annual":
        return f"{day.year}-H{1 if day.month <= 6 else 2}"
    return str(day.year) if frequency == "annual" else day.strftime("%Y-%m")


def read_result(
    indicator: Indicator,
    mapping: IndicatorMapping | None,
    records: list[Submission],
    field: SurveyField | None,
    source_form_id: str | None,
    health: Literal["unmapped", "healthy", "field_missing", "form_missing", "unsupported", "type_mismatch"],
    date_from: date | None = None,
    date_to: date | None = None,
    today: date | None = None,
    period_targets: dict[str, float] | None = None,
    calculator: Callable[[IndicatorMapping | None, list[Submission], SurveyField | None], Calculation] = calculate,
) -> IndicatorRead:
    if calculator is calculate and indicator.reliability_policy:

        def calculator(
            mapping: IndicatorMapping | None, records: list[Submission], field: SurveyField | None
        ) -> Calculation:
            return calculate(mapping, records, field, unit=indicator.unit)

    filtered = []
    for record in records:
        timestamp = record.submitted_at
        day = timestamp.replace(tzinfo=UTC) if timestamp and not timestamp.tzinfo else timestamp
        submission_date = day.astimezone(UTC).date() if day else None
        if date_from and (submission_date is None or submission_date < date_from):
            continue
        if date_to and (submission_date is None or submission_date > date_to):
            continue
        filtered.append(record)
    usable_field = field if health == "healthy" else None
    result = calculator(mapping, filtered, usable_field)
    current = result.value
    achieved = (
        None
        if current is None or indicator.target_value is None
        else (
            current >= indicator.target_value
            if indicator.direction == "increase"
            else current <= indicator.target_value
        )
    )
    schedule = (
        "no_data"
        if current is None
        else "no_target"
        if indicator.target_value is None
        else (
            "achieved"
            if achieved
            else "no_deadline"
            if indicator.target_date is None
            else "overdue"
            if indicator.target_date < (today or datetime.now(UTC).date())
            else "not_due"
        )
    )
    progress = None
    if current is not None and indicator.target_value is not None:
        baseline, target = indicator.baseline_value, indicator.target_value
        if baseline is not None and target != baseline:
            if (indicator.direction == "increase" and target > baseline) or (
                indicator.direction == "decrease" and target < baseline
            ):
                progress = 100 * (current - baseline) / (target - baseline)
        elif indicator.direction == "increase" and target > 0 and current >= 0:
            progress = 100 * current / target
        elif indicator.direction == "decrease" and target > 0 and current > 0:
            progress = 100 * target / current
        elif achieved:
            progress = 100.0
    if progress is not None:
        from math import isfinite

        progress = round(progress, 2) if isfinite(progress) else None
    periods: dict[str, list[Submission]] = defaultdict(list)
    locations: dict[str, list[Submission]] = defaultdict(list)
    for record in filtered:
        period = period_key(record, indicator.reporting_frequency)
        if period:
            periods[period].append(record)
        locations[record.location or "Not reported"].append(record)
    history = []
    targets = {
        period: value
        for period, value in (period_targets or {}).items()
        if (not date_from or period >= period_for_date(date_from, indicator.reporting_frequency))
        and (not date_to or period <= period_for_date(date_to, indicator.reporting_frequency))
    }
    for period in sorted(set(periods) | set(targets)):
        items = periods.get(period, [])
        point = calculator(mapping, items, usable_field)
        period_target = targets.get(period)
        history.append(
            IndicatorResultPoint(
                period=period,
                value=point.value,
                eligible_records=point.eligible_records,
                mapped_records=point.mapped_records,
                numerator=point.numerator,
                denominator=point.denominator,
                missing_records=point.missing_records,
                invalid_answers=point.invalid_answers,
                target_value=period_target,
                target_achieved=None
                if point.value is None or period_target is None
                else (
                    point.value >= period_target if indicator.direction == "increase" else point.value <= period_target
                ),
            )
        )
    breakdown = []
    for location, items in sorted(locations.items()):
        point = calculator(mapping, items, usable_field)
        breakdown.append(
            IndicatorLocationResult(
                location=location,
                value=point.value,
                eligible_records=point.eligible_records,
                mapped_records=point.mapped_records,
                numerator=point.numerator,
                denominator=point.denominator,
            )
        )
    values = IndicatorRead.model_validate(indicator, from_attributes=True).model_dump()
    values.update(
        current_value=current,
        **result.model_dump(exclude={"value"}),
        mapping=mapping,
        source_form_id=source_form_id,
        undated_records=sum(review_eligible(item) and item.submitted_at is None for item in filtered),
        mapping_health=health,
        date_from=date_from,
        date_to=date_to,
        target_achieved=achieved,
        progress_percent=progress,
        schedule_status=schedule,
        status="not_started"
        if current is None
        else "on_track"
        if achieved
        else "needs_attention"
        if schedule == "overdue"
        else "in_progress",
        history=history,
        location_breakdown=breakdown,
        calculation_note=(
            "Only ready submissions from the mapped form are included. "
            "Missing and invalid answers are excluded from answer-based denominators. "
            "Multi-select matching counts each submission once. "
            "Count records includes all ready submissions, even without a question answer. "
            "Period results are independent aggregates, not cumulative totals. "
            "Undated records remain eligible for overall calculations but cannot be assigned to reporting periods. "
            "Below-target results before the deadline are in progress; no pace estimate is assumed."
        ),
    )
    if mapping:
        from app.schemas.indicators import IndicatorMappingRead

        values["mapping"] = IndicatorMappingRead.model_validate(mapping, from_attributes=True)
    if date_from or date_to:
        values["calculation_note"] += " Date filters change actuals; overall and periodic targets are not prorated."
    return IndicatorRead.model_validate(values)
