"""Schema parsing and deterministic aggregation of stored Kobo answers."""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import UTC, date, datetime

import httpx

from app.core.kobo import normalize_kobo_server_url
from app.models.operations import FieldMapping, Submission
from app.schemas.analysis import AnalysisPoint, AnalysisQuery, AnalysisResult, Choice, FieldType, SurveyField


def label_text(value: object, fallback: str = "") -> str:
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, dict):
        values = [value.get("English"), value.get("en"), *value.values()]
    elif isinstance(value, list):
        values = value
    else:
        return fallback
    return next((item for item in values if isinstance(item, str) and item.strip()), fallback)


def read_kobo_schema(server: str, token: str, form_id: str) -> tuple[str | None, list[SurveyField]]:
    from urllib.parse import quote

    try:
        response = httpx.get(
            f"{normalize_kobo_server_url(server)}/api/v2/assets/{quote(form_id, safe='')}/",
            headers={"Authorization": f"Token {token}"},
            timeout=15,
            follow_redirects=False,
        )
        if response.status_code != 200:
            raise ValueError("Kobo form metadata is unavailable.")
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ValueError("Kobo form metadata is unavailable. Stored answers remain available.") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("content"), dict):
        raise ValueError("Kobo returned invalid form metadata.")
    content = payload["content"]
    if not isinstance(content.get("survey"), list):
        raise ValueError("Kobo returned invalid question metadata.")
    choice_lists: dict[str, list[Choice]] = defaultdict(list)
    choices = content.get("choices", [])
    if not isinstance(choices, list):
        raise ValueError("Kobo returned invalid choice metadata.")
    for choice in choices:
        if isinstance(choice, dict) and choice.get("name") is not None:
            value = str(choice["name"])
            choice_lists[str(choice.get("list_name", ""))].append(
                Choice(value=value, label=label_text(choice.get("label"), value))
            )
    fields: list[SurveyField] = []
    groups: list[tuple[str, bool]] = []
    for item in content["survey"]:
        if not isinstance(item, dict):
            continue
        raw_type = str(item.get("type", "text")).replace(" ", "_")
        name = str(item.get("name") or "")
        if raw_type in {"end_group", "end_repeat"}:
            if groups:
                groups.pop()
            continue
        if raw_type in {"begin_group", "begin_repeat"}:
            groups.append((name, raw_type == "begin_repeat"))
            continue
        if not name or raw_type in {"note", "calculate", "start", "end", "today", "deviceid", "username"}:
            continue
        source = "/".join([part for part, _ in groups if part] + [name])
        field_type: FieldType = "text"
        if raw_type.startswith("select_multiple"):
            field_type = "select_multiple"
        elif raw_type.startswith("select_one"):
            field_type = "select_one"
        elif raw_type in {"integer", "decimal"}:
            field_type = "number"
        elif raw_type in {"date", "datetime"}:
            field_type = "date"
        elif raw_type == "geopoint":
            field_type = "geopoint"
        if any(repeat for _, repeat in groups):
            field_type = "repeat"
        list_name = str(item.get("select_from_list_name") or "")
        if not list_name and str(item.get("type", "")).startswith(("select_one ", "select_multiple ")):
            list_name = str(item["type"]).split(" ", 1)[1]
        fields.append(
            SurveyField(
                source_field=source,
                label=label_text(item.get("label"), name.replace("_", " ")),
                type=field_type,
                choices=choice_lists.get(list_name, []),
                source="kobo",
                supported=field_type != "repeat",
            )
        )
    return str(payload["version"]) if payload.get("version") else None, fields


def flatten_answers(answers: dict[str, object], prefix: str = "", depth: int = 0) -> dict[str, object]:
    result: dict[str, object] = {}
    if depth > 8:
        return result
    for key, value in answers.items():
        if key.startswith("_") or key in {"meta", "formhub", "start", "end"}:
            continue
        path = f"{prefix}/{key}" if prefix else key
        if isinstance(value, dict):
            result.update(flatten_answers(value, path, depth + 1))
        else:
            result[path] = value
    return result


def missing(value: object) -> bool:
    return value is None or value == "" or value == [] or (isinstance(value, str) and not value.strip())


def number(value: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except ValueError:
        return None


def answer_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(UTC).date() if parsed.tzinfo else parsed.date()
    except ValueError:
        return None


def build_catalogue(
    records: list[Submission],
    mappings: list[FieldMapping],
    schema_fields: list[SurveyField],
) -> list[SurveyField]:
    observed: dict[str, list[object]] = defaultdict(list)
    for record in records:
        for path, value in flatten_answers(record.raw_answers).items():
            observed[path].append(value)
    fields: dict[str, SurveyField] = {}
    for path, answers in observed.items():
        values = [item for item in answers if not missing(item)]
        field_type: FieldType = "text"
        if values and any(isinstance(item, list) for item in values):
            field_type = (
                "repeat"
                if any(isinstance(item, list) and any(isinstance(child, dict) for child in item) for item in values)
                else "select_multiple"
            )
        elif values and all(number(item) is not None for item in values):
            field_type = "number"
        elif values and all(answer_date(item) is not None for item in values):
            field_type = "date"
        fields[path] = SurveyField(
            source_field=path,
            label=path.replace("_", " "),
            type=field_type,
            supported=field_type != "repeat",
        )
    mapped_types: dict[str, FieldType] = {
        "number": "number",
        "date": "date",
        "single_select": "select_one",
        "multiple_select": "select_multiple",
        "gps": "geopoint",
        "boolean": "select_one",
        "text": "text",
        "location": "text",
    }
    for mapping in mappings:
        fields[mapping.source_field] = SurveyField(
            source_field=mapping.source_field,
            label=mapping.display_name,
            type=mapped_types.get(mapping.data_type, "text"),
            source="mapping",
        )
    for field in schema_fields:
        fields[field.source_field] = field
    return sorted(fields.values(), key=lambda field: (field.label.casefold(), field.source_field))


def categories(value: object, field: SurveyField) -> list[str]:
    if missing(value):
        return []
    if field.type == "select_multiple":
        items = value if isinstance(value, list) else str(value).split()
        return sorted({str(item) for item in items if not missing(item) and not isinstance(item, (dict, list))})
    if isinstance(value, (dict, list)):
        return []
    return [str(value)]


def aggregate(query: AnalysisQuery, records: list[Submission], fields: list[SurveyField]) -> AnalysisResult:
    allowed = {field.source_field: field for field in fields}
    if query.source_field not in allowed or (query.group_by and query.group_by not in allowed):
        raise ValueError("Choose a question from this form's field catalogue.")
    field = allowed[query.source_field]
    if not field.supported or (query.group_by and not allowed[query.group_by].supported):
        raise ValueError("Repeat groups require a separate repeat dataset and cannot be aggregated as submissions.")
    measure = "average" if query.measure == "auto" and field.type == "number" else query.measure
    if measure == "auto":
        measure = "count"
    if measure != "count" and field.type != "number":
        raise ValueError("Numeric aggregation requires a numeric question.")
    filtered = []
    for record in records:
        filters = query.filters
        if record.review_required or record.review_status == "needs_review":
            continue
        if filters.review_status != "all" and record.review_status != filters.review_status:
            continue
        if filters.location is not None and record.location != filters.location:
            continue
        if filters.enumerator is not None and record.enumerator != filters.enumerator:
            continue
        submitted = record.submitted_at
        submitted_day = submitted.replace(tzinfo=UTC) if submitted and not submitted.tzinfo else submitted
        day = submitted_day.astimezone(UTC).date() if submitted_day else None
        if filters.date_from and (day is None or day < filters.date_from):
            continue
        if filters.date_to and (day is None or day > filters.date_to):
            continue
        answers = flatten_answers(record.raw_answers)
        if filters.categories and not set(categories(answers.get(query.source_field), field)) & set(filters.categories):
            continue
        filtered.append((record, answers))
    buckets: dict[tuple[str, str | None], list[float]] = defaultdict(list)
    answered = invalid = 0
    numbers: list[float] = []
    choice_labels = {choice.value: choice.label for choice in field.choices}
    group_labels = {choice.value: choice.label for choice in allowed[query.group_by].choices} if query.group_by else {}
    for record, answers in filtered:
        raw = answers.get(query.source_field)
        if missing(raw):
            continue
        numeric = number(raw) if field.type == "number" else None
        parsed_date = answer_date(raw) if field.type == "date" else None
        values = categories(raw, field)
        if field.type == "geopoint":
            coordinates = raw if isinstance(raw, list) else str(raw).split()
            latitude = number(coordinates[0]) if len(coordinates) >= 2 else None
            longitude = number(coordinates[1]) if len(coordinates) >= 2 else None
            if latitude is None or longitude is None or not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                invalid += 1
                continue
            values = [record.location or "Not reported"]
        if (field.type == "number" and numeric is None) or (field.type == "date" and parsed_date is None) or not values:
            invalid += 1
            continue
        answered += 1
        if numeric is not None:
            numbers.append(numeric)
        groups = categories(answers.get(query.group_by), allowed[query.group_by]) if query.group_by else []
        group_values: list[str | None] = list(groups)
        if not group_values:
            group_values.append(None)
        for group in group_values:
            group_label = (
                group_labels.get(group, group) if group is not None else ("Not reported" if query.group_by else None)
            )
            if field.type == "number":
                names = ["All answers"]
            elif parsed_date:
                length = {"day": 10, "month": 7, "year": 4}[query.time_grain]
                names = [parsed_date.isoformat()[:length]]
            else:
                names = values
            for name in names:
                buckets[(name, group_label)].append(numeric if numeric is not None else 1.0)

    def calculate(values: list[float]) -> float | None:
        if measure == "count":
            return float(len(values))
        if not values:
            return None
        if measure == "sum":
            result = sum(values)
        elif measure == "average":
            result = sum(values) / len(values)
        elif measure == "min":
            result = min(values)
        else:
            result = max(values)
        return result if math.isfinite(result) else None

    points = [
        AnalysisPoint(
            name=choice_labels.get(name, name),
            group=group,
            value=calculate(values),
            count=len(values),
            percent=round(100 * len(values) / answered, 2) if answered else None,
        )
        for (name, group), values in sorted(buckets.items(), key=lambda item: (item[0][0], item[0][1] or ""))
    ]
    # Bound the response without silently truncating counts or returning raw rows.
    if len(points) > 2000:
        raise ValueError("This question has too many categories. Narrow the filters or choose another question.")
    note = "Percentages use usable answered submissions as denominator. Dates and date filters use UTC."
    if field.type == "select_multiple":
        note += " Each option is counted once per submission; percentages may total more than 100%."
    if query.group_by:
        note += " Missing group values are Not reported; multi-select groups may overlap."
    if field.type == "geopoint":
        note += " Valid coordinates are grouped by the submission location; exact coordinates are not exported."
    if field.source == "inferred":
        note += " Question type is inferred from stored answers; refresh Kobo fields to verify its type."
    return AnalysisResult(
        project_id=query.project_id,
        form_id=query.form_id,
        field=field,
        measure=measure,
        total_records=len(records),
        eligible_records=len(filtered),
        answered_records=answered,
        missing_records=len(filtered) - answered - invalid,
        invalid_answers=invalid,
        denominator=answered,
        value=calculate(numbers) if field.type == "number" else float(answered),
        series=points,
        filters=query.filters,
        group_by=query.group_by,
        note=note,
        generated_at=datetime.now(UTC),
    )
