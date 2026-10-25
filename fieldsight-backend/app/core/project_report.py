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
