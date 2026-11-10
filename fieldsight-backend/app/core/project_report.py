"""A reproducible PDF export of the authoritative indicator result contract."""

from datetime import UTC, date, datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

import reportlab
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.operations import Project
from app.schemas.indicators import IndicatorRead

FONT_DIRECTORY = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("FieldSight", str(FONT_DIRECTORY / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("FieldSightBold", str(FONT_DIRECTORY / "VeraBd.ttf")))


def project_report(
    project: Project,
    indicators: list[IndicatorRead],
    counts: dict[str, int],
    start: date | None,
    end: date | None,
    last_sync: datetime | None,
) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=44,
        bottomMargin=42,
        title=f"FieldSight - {project.name}",
        author="FieldSight",
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle("FSBody", fontName="FieldSight", fontSize=9, leading=14, textColor=colors.HexColor("#24434c"))
    )
    styles.add(
        ParagraphStyle("FSMeta", parent=styles["FSBody"], fontSize=8, leading=12, textColor=colors.HexColor("#637580"))
    )
    styles.add(ParagraphStyle("FSTitle", parent=styles["FSBody"], fontName="FieldSightBold", fontSize=20, leading=26))
    styles.add(ParagraphStyle("FSHeading", parent=styles["FSBody"], fontName="FieldSightBold", fontSize=11, leading=16))

    def paragraph(value: object, style: str = "FSBody") -> Paragraph:
        text = "".join(char for char in str(value) if ord(char) >= 32 or char in "\n\t")
        return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])

    def numeric(value: float | None) -> str:
        return "Not reported" if value is None else f"{value:,.2f}".rstrip("0").rstrip(".")

    generated = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    story = [
        paragraph("FIELDSIGHT / PROJECT REPORT", "FSMeta"),
        Spacer(1, 8),
        paragraph(project.name, "FSTitle"),
        Spacer(1, 10),
        paragraph(project.description),
        Spacer(1, 12),
        paragraph(f"Reporting window: {start or 'All dates'} through {end or 'Present'} (UTC).", "FSMeta"),
        paragraph(
            f"Generated: {generated}. Last successful sync: {last_sync.isoformat() if last_sync else 'Not recorded'}.",
            "FSMeta",
        ),
        paragraph(
            "Generated from current saved data. FieldSight does not retain a historical snapshot for this report. "
            "Dates filter actuals; overall targets are not prorated.",
            "FSMeta",
        ),
        Spacer(1, 16),
    ]
    summary = Table(
        [
            [paragraph("Ready"), paragraph("Needs review"), paragraph("Invalid")],
            [
                paragraph(counts.get("ready", 0), "FSHeading"),
                paragraph(counts.get("needs_review", 0), "FSHeading"),
                paragraph(counts.get("invalid", 0), "FSHeading"),
            ],
        ],
        colWidths=[171, 171, 173],
    )
    summary.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f6fa")),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story += [
        summary,
        Spacer(1, 6),
        paragraph(
            "Submission counts in the selected window. Linked indicators use ready records; "
            "manual entries are independent of submission review.",
            "FSMeta",
        ),
        Spacer(1, 18),
    ]
    if not indicators:
        story.append(paragraph("No indicators configured for this project."))
    for item in indicators:
        actual = (
            ("Narrative below" if item.qualitative_value else "Not reported")
            if item.unit == "text"
            else numeric(item.current_value)
        )
        if item.unit == "percentage" and item.current_value is not None:
            actual += "%"
        cells = [
            [paragraph("Actual"), paragraph("Baseline"), paragraph("Overall target")],
            [
                paragraph(actual, "FSHeading"),
                paragraph(numeric(item.baseline_value)),
                paragraph(numeric(item.target_value)),
            ],
        ]
        values = Table(cells, colWidths=[231, 142, 142])
        values.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef4f7")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        source = (
            f"{item.manual_result_count} manual entries"
            if item.result_source == "manual"
            else (
                f"{item.eligible_records} eligible ready records from {item.source_form_id or 'an unconfigured source'}"
            )
        )
        if item.result_source == "unconfigured":
            source = "Not configured"
        story.append(
            KeepTogether(
                [
                    paragraph(f"{item.code} - {item.name}", "FSHeading"),
                    Spacer(1, 5),
                    values,
                    Spacer(1, 5),
                    paragraph(
                        f"Unit: {item.unit}. Reporting period: {item.reporting_frequency}. "
                        f"Status: {item.schedule_status.replace('_', ' ')}. Source: {source}.",
                        "FSMeta",
                    ),
                    paragraph(
                        f"Missing: {item.missing_records}; invalid answers: {item.invalid_answers}; "
                        f"excluded by review: {item.quality_excluded_records}. "
                        f"Numerator: {numeric(item.numerator)}; denominator: {numeric(item.denominator)}.",
                        "FSMeta",
                    ),
                    paragraph(item.calculation_note, "FSMeta"),
                    Spacer(1, 18),
                ]
            )
        )
        if item.unit == "text" and item.qualitative_value:
            # Narrative paragraphs can split across pages; table rows cannot.
            story.extend([paragraph(item.qualitative_value), Spacer(1, 18)])

    def footer(canvas: Canvas, _document: SimpleDocTemplate) -> None:
        canvas.setFont("FieldSight", 8)
        canvas.setFillColor(colors.HexColor("#637580"))
        canvas.drawString(40, 24, "FieldSight - current data export")
        canvas.drawRightString(A4[0] - 40, 24, f"Page {canvas.getPageNumber()}")

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def saved_report_pdf(data: dict) -> bytes:
    """Render only captured values, using ReportLab vector charts (no browser dependency)."""
    from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String
    from reportlab.platypus import PageBreak

    output = BytesIO()
    report = data["report"]
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=48,
        bottomMargin=44,
        title=report["title"],
        author="FieldSight",
    )
    styles = getSampleStyleSheet()
    for name in ("Normal", "Title", "Heading1", "Heading2"):
        styles[name].fontName = "FieldSightBold" if name != "Normal" else "FieldSight"
        styles[name].textColor = colors.HexColor("#24434c")
    styles["Normal"].fontSize = 9
    styles["Normal"].leading = 14
    styles["Heading2"].keepWithNext = True

    def p(value: object, style: str = "Normal") -> Paragraph:
        text = "".join(c for c in str(value or "") if ord(c) >= 32 or c in "\n\t")
        return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])

    def number(value: float | None) -> str:
        return "Not reported" if value is None else f"{value:,.2f}".rstrip("0").rstrip(".")

    story = [
        Spacer(1, 70),
        p("FIELDSIGHT / MONITORING & EVALUATION"),
        Spacer(1, 24),
        p(report["title"], "Title"),
        Spacer(1, 24),
        p(data["organization"]["name"], "Heading1"),
        p(data["project"]["name"], "Heading2"),
        p(f"{report['reporting_period_start']} through {report['reporting_period_end']} (UTC)"),
        Spacer(1, 20),
        p(f"Published: {data['published_at']}" if data.get('published_at') else "Draft preview - not published"),
        p(f"Template: {report['template_key']}. Revision: {report['revision_number']}"),
        PageBreak(),
    ]
    sections = report["sections"]

    def section(key: str) -> None:
        story.extend(
            [
                p(key.replace("_", " ").title() + " - user-authored", "Heading2"),
                p(sections.get(key) or "No narrative provided."),
                Spacer(1, 12),
            ]
        )

    section("executive_summary")
    story.extend(
        [p("Project overview", "Heading2"), p(data["project"]["description"]), p(report["description"]), Spacer(1, 12)]
    )
    for key in sections:
        if key not in {"executive_summary", "key_findings", "challenges", "recommendations", "conclusion"}:
            section(key)
    story.append(p("Indicator performance - calculated data", "Heading1"))
    counts = data["review_counts"]
    story.append(
        p("Submission review counts: " + "; ".join(f"{key}: {value}" for key, value in sorted(counts.items())))
    )
    status_counts: dict[str, int] = {}
    for item in data["indicators"]:
        status_counts[item["schedule_status"]] = status_counts.get(item["schedule_status"], 0) + 1
    story.append(
        p(
            "Status summary: "
            + (
                "; ".join(f"{key.replace('_', ' ')}: {value}" for key, value in sorted(status_counts.items()))
                or "No indicators selected."
            )
        )
    )
    for item in data["indicators"]:
        story.append(p(f"{item['code']} - {item['name']}", "Heading2"))
        story.append(
            p(
                f"Unit: {item['unit']}; direction: {item['direction']}; "
                f"status: {item['schedule_status'].replace('_', ' ')}; "
                f"overall progress: {number(item['progress_percent'])}"
                + ("%" if item["progress_percent"] is not None else "")
            )
        )
        rows = [
            [p("Actual"), p("Overall target"), p("Baseline")],
            [p(number(item["current_value"])), p(number(item["target_value"])), p(number(item["baseline_value"]))],
        ]
        table = Table(rows, colWidths=[171, 171, 173], repeatRows=1, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef4f7")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        story.extend([table, Spacer(1, 8)])
        if item["unit"] != "text":
            values = [("Actual", item["current_value"]), ("Overall target", item["target_value"])]
            maximum = max([abs(v) for _, v in values if v is not None] + [1])
            drawing = Drawing(510, 66)
            for index, (label, value) in enumerate(values):
                y = 42 - index * 28
                drawing.add(String(0, y + 4, label, fontName="FieldSight", fontSize=8))
                if value is not None:
                    drawing.add(
                        Rect(
                            240 if value >= 0 else 240 - abs(value) / maximum * 140,
                            y,
                            abs(value) / maximum * 140,
                            14,
                            fillColor=colors.HexColor("#146b72" if index == 0 else "#a4b6c3"),
                            strokeColor=None,
                        )
                    )
                drawing.add(String(405, y + 4, number(value), fontName="FieldSight", fontSize=8))
            story.append(drawing)
        if item.get("qualitative_value"):
            story.append(p(item["qualitative_value"]))
        history = item.get("history", [])
        if history:
            story.append(p("Reporting period trend / exact period targets", "Heading2"))
            if item["unit"] != "text":
                drawing = Drawing(510, 170)
                numbers = [
                    point.get(key)
                    for point in history
                    for key in ("value", "target_value")
                    if point.get(key) is not None
                ]
                low, high = min(numbers + [0]), max(numbers + [1])
                span = high - low or 1
                drawing.add(Line(45, 30, 490, 30, strokeColor=colors.HexColor("#cbd5e1")))
                drawing.add(String(0, 145, number(high), fontName="FieldSight", fontSize=7))
                drawing.add(String(0, 30, number(low), fontName="FieldSight", fontSize=7))
                for key, color in (("value", "#146b72"), ("target_value", "#64748b")):
                    previous = None
                    for index, point in enumerate(history):
                        value = point.get(key)
                        if value is None:
                            previous = None
                            continue
                        x = 45 + index / max(len(history) - 1, 1) * 440
                        y = 30 + (value - low) / span * 110
                        drawing.add(Circle(x, y, 2, fillColor=colors.HexColor(color), strokeColor=None))
                        if previous is not None:
                            drawing.add(Line(*previous, x, y, strokeColor=colors.HexColor(color)))
                        previous = (x, y)
                drawing.add(String(45, 14, history[0]["period"], fontName="FieldSight", fontSize=7))
                drawing.add(String(430, 14, history[-1]["period"], fontName="FieldSight", fontSize=7))
                drawing.add(String(45, 158, "Actual (teal) / Period target (slate)", fontName="FieldSight", fontSize=8))
                story.append(drawing)
            rows = [[p("UTC period"), p("Actual"), p("Period target"), p("Achieved")]]
            for point in history:
                achieved = point.get("target_achieved")
                rows.append(
                    [
                        p(point["period"]),
                        p(number(point["value"])),
                        p(number(point.get("target_value"))),
                        p("Not applicable" if achieved is None else "Yes" if achieved else "No"),
                    ]
                )
            trend = Table(rows, colWidths=[130, 130, 130, 125], repeatRows=1)
            trend.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef4f7")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                    ]
                )
            )
            story.append(trend)
        story.extend(
            [
                p(
                    f"Source: {item['result_source']}. Eligible records: {item['eligible_records']}. "
                    f"Excluded by review: {item['quality_excluded_records']}."
                ),
                p(item["calculation_note"]),
                Spacer(1, 16),
            ]
        )
    for key in ("key_findings", "challenges", "recommendations", "conclusion"):
        section(key)
    story.extend([p("Data sources and methodology", "Heading2"), p(data["methodology"])])
    if data.get("framework"):
        story.append(p("Results framework", "Heading2"))
        for node in data["framework"]:
            story.append(p(f"{node['node_type']}: {node['title']}"))

    def footer(canvas: Canvas, _doc: SimpleDocTemplate) -> None:
        canvas.setFont("FieldSight", 8)
        canvas.setFillColor(colors.HexColor("#637580"))
        canvas.drawString(40, 24, report["title"][:75])
        canvas.drawRightString(A4[0] - 40, 24, f"Page {canvas.getPageNumber()}")

    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
