"""Portable dashboard charts and exact results, generated from authorized aggregates."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.charts.doughnut import Doughnut
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.project_report import FONT_DIRECTORY  # Registers the shared Unicode fonts.


def dashboard_report(title: str, project: str, description: str, results: list[tuple[str, dict]]) -> bytes:
    _ = FONT_DIRECTORY  # Font registration is performed by the shared report module.
    output = BytesIO()
    styles = getSampleStyleSheet()
    for style in styles.byName.values():
        style.fontName = "FieldSight"
    story = []

    def text(value: object, style: str = "BodyText") -> Paragraph:
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), styles[style])

    story.extend(
        [
            text(title, "Title"),
            text(project),
            text(description),
            Spacer(1, 16),
        ]
    )
    for index, (name, payload) in enumerate(results):
        if index:
            story.append(PageBreak())
        story.append(text(name, "Heading2"))
        if payload["kind"] == "text":
            story.append(text(payload.get("text") or "No text provided."))
            continue
        if payload["kind"] == "indicator":
            item = payload["indicator"]
            value = item.qualitative_value if item.unit == "text" else item.current_value
            story.extend(
                [
                    text(f"Current result: {value if value is not None else 'Not reported'}"),
                    text(f"Overall target: {item.target_value if item.target_value is not None else 'Not reported'}"),
                ]
            )
            if item.progress_percent is not None:
                drawing = Drawing(450, 35)
                drawing.add(Rect(0, 10, 440, 14, fillColor=colors.HexColor("#eff6ff"), strokeColor=None))
                drawing.add(
                    Rect(
                        0,
                        10,
                        440 * max(0, min(100, item.progress_percent)) / 100,
                        14,
                        fillColor=colors.HexColor("#0b51b7"),
                        strokeColor=None,
                    )
                )
                story.extend([drawing, text(f"Target attainment: {item.progress_percent:g}%")])
            continue
        result = payload["analysis"]
        story.append(text(result.field.label))
        if result.filters.location:
            story.append(text(f"Location: {result.filters.location}"))
        if result.filters.enumerator:
            story.append(text(f"Enumerator: {result.filters.enumerator}"))
        points = result.series
        if not points:
            story.append(text("No answered records match this chart's source and filters."))
            continue
        palette = [colors.HexColor(value) for value in ("#245493", "#38843f", "#7954a1", "#e28b32", "#bd4444")]
        if payload["chart"] in {"pie", "donut"} and any((p.value or 0) > 0 for p in points):
            drawing = Drawing(450, 220)
            chart = Doughnut()
            chart.x, chart.y, chart.width, chart.height = 110, 10, 200, 200
            chart.data = [max(0, p.value or 0) for p in points]
            chart.labels = [p.name for p in points]
            for i, point in enumerate(points):
                chart.slices[i].fillColor = (
                    colors.HexColor("#245493" if point.name.lower() == "yes" else "#38843f")
                    if point.name.lower() in {"yes", "no"}
                    else palette[i % len(palette)]
                )
            drawing.add(chart)
            story.append(drawing)
        elif payload["chart"] in {"bar", "line"}:
            # The table retains every point; limit the plot to the same 60-category UI budget.
            plotted = points[:60]
            drawing = Drawing(450, 170)
            low = min(0, *(p.value or 0 for p in plotted))
            high = max(0, *(p.value or 0 for p in plotted))
            scale = 140 / (high - low or 1)
            zero = 15 - low * scale
            drawing.add(Line(10, zero, 440, zero, strokeColor=colors.grey))
            previous = None
            for i, point in enumerate(plotted):
                x = 15 + i * 420 / len(plotted)
                y = zero + (point.value or 0) * scale
                if payload["chart"] == "line":
                    if previous is not None:
                        drawing.add(Line(*previous, x, y, strokeColor=palette[0], strokeWidth=2))
                    drawing.add(Rect(x - 2, y - 2, 4, 4, fillColor=palette[0], strokeColor=None))
                    previous = (x, y)
                else:
                    drawing.add(
                        Rect(
                            x,
                            min(y, zero),
                            max(2, 300 / len(plotted)),
                            abs(y - zero),
                            fillColor=palette[0],
                            strokeColor=None,
                        )
                    )
                drawing.add(String(x, max(y, zero) + 3, f"{point.value or 0:g}", fontSize=7))
            story.append(drawing)
        rows = [[text("Response / period"), text("Group"), text("Value"), text("Records")]]
        rows.extend(
            [
                [text(p.name), text(p.group or "—"), text(p.value if p.value is not None else "—"), text(p.count)]
                for p in points
            ]
        )
        table = Table(rows, colWidths=[230, 120, 65, 65], repeatRows=1, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eff6ff")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            )
        )
        story.append(table)
    SimpleDocTemplate(output, title=title, author="FieldSight", leftMargin=40, rightMargin=40).build(story)
    return output.getvalue()
