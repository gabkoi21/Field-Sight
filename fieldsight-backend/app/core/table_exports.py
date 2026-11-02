"""Complete table reports. Period bounds are inclusive local calendar dates."""

import calendar
import csv
import io
import json
import re
from collections import Counter, defaultdict
from datetime import UTC, date, datetime, timedelta
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlmodel import Session, col, select

from app.core.survey import flatten_answers, number
from app.models.operations import Project, Submission, SurveySchema
from app.schemas.table_exports import TableExportInput

MAX_RECORDS = 100_000


def bounds(options: TableExportInput) -> tuple[date | None, date | None]:
    anchor = options.anchor
    if options.period == "all":
        return None, None
    if options.period == "monthly":
        return anchor.replace(day=1), anchor.replace(day=calendar.monthrange(anchor.year, anchor.month)[1])
    if options.period == "custom":
        return anchor, options.end
    start = (
        anchor
        if options.period == "fortnightly"
        else anchor - timedelta(days=(anchor.weekday() - options.week_start) % 7)
    )
    return start, start + timedelta(days=13 if options.period == "fortnightly" else 6)


def next_period(options: TableExportInput, start: date, end: date) -> TableExportInput:
    return options.model_copy(update={"anchor": end + timedelta(days=1)})


def previous_bounds(options: TableExportInput, start: date, end: date) -> tuple[date, date]:
    if options.period == "monthly":
        previous_end = start - timedelta(days=1)
        return previous_end.replace(day=1), previous_end
    return start - timedelta(days=(end - start).days + 1), start - timedelta(days=1)


def text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def safe_csv(value: object) -> str:
    value = text(value)
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value


def record_date(item: Submission, answers: dict, options: TableExportInput) -> date | None:
    value = answers.get(options.date_field) if options.date_field else item.submitted_at
    if value is None or value == "":
        return None
    try:
        if isinstance(value, datetime):
            parsed = value
        else:
            raw = str(value).strip()
            if len(raw) == 10:
                return date.fromisoformat(raw)
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=parsed.tzinfo or UTC).astimezone(ZoneInfo(options.timezone)).date()
    except (ValueError, TypeError, OverflowError):
        return None


def build_report(db: Session, project: Project, form: str, options: TableExportInput) -> dict:
    statement = select(Submission).where(
        Submission.organization_id == project.organization_id,
        Submission.project_id == project.id,
        Submission.kobo_form_id == form,
    )
    schema = db.exec(
        select(SurveySchema).where(
            SurveySchema.organization_id == project.organization_id,
            SurveySchema.project_id == project.id,
            SurveySchema.form_id == form,
        )
    ).first()
    if not schema and not db.exec(statement.limit(1)).first():
        raise HTTPException(404, "Table was not found.")
    fields = list(schema.fields_json) if schema else []
    # Match the table's inferred catalogue for legacy forms too.
    if not schema:
        from app.routes.analysis import _catalogue

        catalogue, _, _ = _catalogue(project, form, db)
        fields = [field.model_dump(mode="json") for field in catalogue.fields]
    keys = {str(f["source_field"]) for f in fields}
    county_field = next((f for f in fields if f["source_field"] == options.county_field), None)
    if options.county_field and not county_field:
        raise HTTPException(422, "The county field is not in this table.")
    if not county_field:
        county_field = next(
            (
                f
                for f in fields
                if re.search(r"\bcounty\b", str(f.get("label", "")), re.I)
                or re.search(r"(?:^|[/_])county$", str(f["source_field"]), re.I)
            ),
            None,
        )
    if options.county and not county_field:
        raise HTTPException(422, "This table has no county field. Choose All counties to export every record.")

    def county_key(value):
        return re.sub(r"[^a-z]", "", str(value).casefold().replace("county", ""))

    def county_name(answers):
        raw = answers.get(str(county_field["source_field"])) if county_field else None
        for choice in county_field.get("choices", []) if county_field else []:
            if str(choice.get("value")) == str(raw):
                return str(choice.get("label") or raw)
        return text(raw) or "Unknown"

    if options.date_field and options.date_field not in keys:
        raise HTTPException(422, "The reporting date field is not in this table.")
    if options.metric_field and options.metric_field not in keys:
        raise HTTPException(422, "The result field is not in this table.")
    if options.columns is not None and (
        len(set(options.columns)) != len(options.columns) or not set(options.columns) <= keys
    ):
        raise HTTPException(422, "Choose unique columns from this table.")
    selected = fields if options.columns is None else [f for f in fields if f["source_field"] in options.columns]
    start, end = bounds(options)
    previous = previous_bounds(options, start, end) if start and end and options.compare else None
    current, earlier = [], []
    missing_dates = 0
    scanned = 0
    for item in db.exec(
        statement.order_by(col(Submission.submitted_at), col(Submission.id)).execution_options(yield_per=500)
    ):
        scanned += 1
        if scanned > MAX_RECORDS:
            raise HTTPException(422, "This table exceeds the 100,000-record export limit. Export a smaller table.")
        answers = flatten_answers(item.raw_answers)
        county = county_name(answers)
        if options.county and county_key(county) != county_key(options.county):
            continue
        if options.review_status != "all" and item.review_status != options.review_status:
            continue
        if (
            options.search.casefold()
            not in text([answers, item.enumerator, item.location, item.external_id]).casefold()
        ):
            continue
        day = record_date(item, answers, options)
        if day is None:
            missing_dates += 1
        row = {
            "submission_id": str(item.id),
            "external_id": item.external_id,
            "submitted_at_utc": item.submitted_at.replace(tzinfo=item.submitted_at.tzinfo or UTC)
            .astimezone(UTC)
            .isoformat()
            if item.submitted_at
            else None,
            "submitted_by": item.enumerator or "Unknown",
            "location": item.location or "Unknown",
            "county": county,
            "review_status": item.review_status,
            "reporting_date": day.isoformat() if day else None,
            "answers": answers,
        }
        if start is None or (day is not None and start <= day <= end):
            current.append(row)
        elif previous and day is not None and previous[0] <= day <= previous[1]:
            earlier.append(row)

    def aggregate(rows):
        values = [number(r["answers"].get(options.metric_field)) for r in rows] if options.metric_field else []
        valid = [v for v in values if v is not None]
        return {
            "submissions": len(rows),
            "review_status": dict(Counter(r["review_status"] for r in rows)),
            "result": (sum(valid) / len(valid) if options.metric == "average" else sum(valid)) if valid else None,
            "result_answered": len(valid),
            "result_missing_or_invalid": len(values) - len(valid),
        }

    groups = defaultdict(list)
    for row in current:
        if options.group_by == "week":
            day = date.fromisoformat(row["reporting_date"]) if row["reporting_date"] else None
            label = (
                (day - timedelta(days=(day.weekday() - options.week_start) % 7)).isoformat() if day else "Missing date"
            )
        elif options.group_by == "county":
            label = row["county"]
        else:
            label = row["location" if options.group_by == "location" else "submitted_by"]
        groups[label].append(row)
    summary = aggregate(current)
    comparison = None
    if previous:
        prior = aggregate(earlier)
        comparison = {
            "start": previous[0].isoformat(),
            "end": previous[1].isoformat(),
            **prior,
            "submission_change": len(current) - len(earlier),
            "submission_change_percent": round((len(current) - len(earlier)) / len(earlier) * 100, 2)
            if earlier
            else None,
            "result_change": summary["result"] - prior["result"]
            if summary["result"] is not None and prior["result"] is not None
            else None,
        }
    breakdown = [{"group": key, **aggregate(value)} for key, value in sorted(groups.items())]
    if options.group_by == "county":
        current.sort(key=lambda row: (county_key(row["county"]), row["submitted_at_utc"] or "", row["submission_id"]))
    # Export only the selected answer columns, including in JSON.
    for row in current:
        row["answers"] = {str(f["source_field"]): row["answers"].get(str(f["source_field"])) for f in selected}
        row.pop("submission_id", None)
    title = (
        schema.version.removeprefix("CSV: ")
        if schema and schema.version and schema.version.startswith("CSV: ")
        else (project.kobo_form_name or form)
        if project.kobo_form_id == form
        else form
    )
    return {
        "project": project.name,
        "table": title,
        "form_id": form,
        "generated_at": datetime.now(UTC).isoformat(),
        "period": options.period,
        "start": start.isoformat() if start else None,
        "end": end.isoformat() if end else None,
        "timezone": options.timezone,
        "date_basis": options.date_field or "submission date",
        "filters": {"review_status": options.review_status, "search": options.search, "county": options.county},
        "undated_records": missing_dates,
        "undated_excluded": missing_dates if start else 0,
        "metric_field": options.metric_field,
        "metric": options.metric,
        "summary": summary,
        "comparison": comparison,
        "breakdown_by": options.group_by,
        "breakdown": breakdown,
        "fields": selected,
        "records": current,
    }


def report_tables(report: dict, options: TableExportInput) -> list[tuple[str, list[list]]]:
    tables = []
    if options.content in ("summary", "both"):
        summary = [
            ["FieldSight period report", "Value"],
            ["Project", report["project"]],
            ["Table", report["table"]],
            ["Period", report["period"]],
            ["Start (inclusive)", report["start"] or "All dates"],
            ["End (inclusive)", report["end"] or "All dates"],
            ["Timezone", report["timezone"]],
            ["Date basis", report["date_basis"]],
            ["Generated at", report["generated_at"]],
            ["Review filter", options.review_status],
            ["Search filter", options.search],
            ["Total submissions", report["summary"]["submissions"]],
            ["Undated records excluded", report["undated_excluded"]],
        ]
        summary += [[f"Status: {key}", value] for key, value in sorted(report["summary"]["review_status"].items())]
        if options.metric_field:
            summary += [
                ["Result field", options.metric_field],
                ["Aggregation", options.metric],
                ["Result", report["summary"]["result"]],
                ["Answered", report["summary"]["result_answered"]],
                ["Missing / invalid result", report["summary"]["result_missing_or_invalid"]],
            ]
        if report["comparison"]:
            summary += [[f"Previous period: {key}", value] for key, value in report["comparison"].items()]
        tables.append(("Summary", summary))
        tables.append(
            (
                "Period breakdown",
                [[options.group_by, "Submissions", "Ready", "Needs review", "Invalid", "Result"]]
                + [
                    [
                        r["group"],
                        r["submissions"],
                        r["review_status"].get("ready", 0),
                        r["review_status"].get("needs_review", 0),
                        r["review_status"].get("invalid", 0),
                        r["result"],
                    ]
                    for r in report["breakdown"]
                ],
            )
        )
    if options.content in ("records", "both"):
        metadata = [
            "external_id",
            "submitted_at_utc",
            "submitted_by",
            "location",
            "review_status",
            "reporting_date",
        ]
        tables.append(
            (
                "Records",
                [metadata + [f"{f['label']} [{f['source_field']}]" for f in report["fields"]]]
                + [
                    [row[k] for k in metadata] + [row["answers"].get(str(f["source_field"])) for f in report["fields"]]
                    for row in report["records"]
                ],
            )
        )
        tables.append(
            (
                "Field definitions",
                [["Field", "Label", "Type", "Choices"]]
                + [[f["source_field"], f["label"], f.get("type"), f.get("choices", [])] for f in report["fields"]],
            )
        )
    return tables


def render_report(report: dict, options: TableExportInput) -> tuple[bytes, str, str]:
    tables = report_tables(report, options)
    period = f"{report['start']}_to_{report['end']}" if report["start"] else "All-dates"

    def slug(value):
        return re.sub(r"[^\w-]+", "_", value, flags=re.ASCII).strip("_")[:60] or "Table"

    filename = (
        f"FieldSight_{slug(report['project'])}_{slug(report['table'])}_{period}_{options.period}.{options.format}"
    )
    if options.county:
        filename = filename.removesuffix(f".{options.format}") + f"_{slug(options.county)}.{options.format}"
    if options.format == "json":
        payload = dict(report)
        if options.content == "records":
            for key in ("summary", "comparison", "breakdown"):
                payload.pop(key)
        if options.content == "summary":
            payload.pop("records")
            payload.pop("fields")
        return json.dumps(payload, ensure_ascii=False, default=str).encode(), "application/json", filename
    if options.format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        for index, (name, rows) in enumerate(tables):
            # Records-only CSV remains a rectangular dataset for analysis tools.
            if options.content == "records" and name != "Records":
                continue
            if options.content != "records":
                if index:
                    writer.writerow([])
                writer.writerow([name])
            writer.writerows([[safe_csv(v) for v in row] for row in rows])
        return ("\ufeff" + output.getvalue()).encode(), "text/csv; charset=utf-8", filename
    output = io.BytesIO()
    if options.format == "xlsx":
        import xlsxwriter

        with xlsxwriter.Workbook(
            output, {"in_memory": True, "strings_to_formulas": False, "strings_to_urls": False}
        ) as book:
            for name, rows in tables:
                if len(rows[0]) > 16384:
                    raise HTTPException(422, "Too many columns for Excel. Choose fewer columns.")
                sheet = book.add_worksheet(name)
                for row_index, row in enumerate(rows):
                    for column, value in enumerate(row):
                        value = text(value) if not isinstance(value, (int, float, bool)) else value
                        if isinstance(value, str) and len(value) > 32767:
                            raise HTTPException(422, "A value exceeds Excel's cell limit. Use JSON for this table.")
                        sheet.write(row_index, column, value)
        return output.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

    styles = getSampleStyleSheet()
    story = [
        Paragraph(escape(f"FieldSight — {report['project']}"), styles["Title"]),
        Paragraph(escape(f"{period} · {report['timezone']} · {report['date_basis']}"), styles["Normal"]),
    ]
    # Split wide records into column bands; retain the first column in each band.
    for name, rows in tables:
        width = 6
        bands = [list(range(min(width, len(rows[0]))))]
        for offset in range(width, len(rows[0]), width - 1):
            bands.append([0] + list(range(offset, min(offset + width - 1, len(rows[0])))))
        for band in bands:
            story += [Spacer(1, 12), Paragraph(escape(name), styles["Heading2"])]
            data = [
                [Paragraph(escape(text(row[i])).replace("\n", "<br/>"), styles["Normal"]) for i in band] for row in rows
            ]
            table = LongTable(data, repeatRows=1, colWidths=[750 / len(band)] * len(band), splitInRow=1)
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCEDEF")),
                        ("GRID", (0, 0), (-1, -1), 0.3, colors.lightgrey),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                )
            )
            story.append(table)

    def footer(canvas, doc):
        canvas.drawString(36, 18, f"FieldSight | Page {doc.page}")

    SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=36, rightMargin=36).build(
        story, onFirstPage=footer, onLaterPages=footer
    )
    return output.getvalue(), "application/pdf", filename
