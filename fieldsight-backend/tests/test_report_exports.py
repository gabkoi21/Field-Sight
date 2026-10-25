"""Full filtered CSV and real PDF exports, using disposable project data."""

import csv
import io
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from pypdf import PdfReader
from sqlmodel import Session
from test_kobo_sync import sync_client as sync_client

from app.models.operations import Project, Submission


def test_csv_exports_all_filtered_rows_and_escapes_formula_cells(sync_client):
    client, engine, project_id, headers = sync_client
    with Session(engine) as db:
        project = db.get(Project, UUID(project_id))
        for index in range(27):
            db.add(
                Submission(
                    project_id=project.id,
                    organization_id=project.organization_id,
                    kobo_connection_id=project.kobo_connection_id,
                    kobo_form_id="form-1",
                    external_id=str(index),
                    enumerator="=HYPERLINK(unsafe)",
                    submitted_at=datetime(2026, 10, 1, tzinfo=UTC),
                    review_status="ready" if index < 25 else "invalid",
                )
            )
        db.commit()
    path = f"/submissions/export.csv?project_id={project_id}&review_status=ready&search=HYPERLINK"
    response = client.get(path, headers=headers)
    assert response.status_code == 200 and "text/csv" in response.headers["content-type"]
    rows = list(csv.DictReader(io.StringIO(response.text.lstrip("\ufeff"))))
    assert len(rows) == 25 and all(row["enumerator"].startswith("'=") for row in rows)
    assert client.get(path + "&date_from=2027-01-01T00:00:00Z", headers=headers).text.count("\n") == 1
    assert client.get(f"/submissions/export.csv?project_id={uuid4()}", headers=headers).text.count("\n") == 1
    assert client.get(path).status_code == 401


def test_project_pdf_has_correct_results_source_notes_and_page_footers(sync_client):
    client, engine, project, headers = sync_client
    with Session(engine) as db:
        item = db.get(Project, UUID(project))
        item.name = "Synthetic QA - Community health and school attendance"
        item.description = "Synthetic report fixture. This contains no production data or personal records."
        db.add(item)
        db.commit()
    for index, name in enumerate(
        ["Total visits", "Zero is reported", "No data yet", "Pooled coverage across communities"]
    ):
        pooled = index == 3
        created = client.post(
            f"/projects/{project}/indicators",
            headers=headers,
            json={
                "name": name,
                "code": f"QA-{index}",
                "unit": "percentage" if pooled else "number",
                "manual_aggregation": "pooled" if pooled else "sum",
                "target_value": 100,
            },
        )
        assert created.status_code == 201, created.text
        identifier = created.json()["id"]
        if index == 2:
            continue
        fractions = [{"numerator": 9, "denominator": 10}, {"numerator": 1, "denominator": 90}]
        for value in fractions if pooled else [{"value": 30 if index == 0 else 0}]:
            added = client.post(
                f"/indicators/{identifier}/collected-results",
                headers=headers,
                json={"result_date": "2026-10-01", **value},
            )
            assert added.status_code == 201, added.text
    response = client.get(f"/projects/{project}/report.pdf", headers=headers)
    assert response.status_code == 200, response.text[:100]
    assert response.content.startswith(b"%PDF-")
    reader = PdfReader(io.BytesIO(response.content))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "30" in text and "10%" in text and "Not reported" in text
    assert "Pooled manual results" in text and "historical snapshot" in text
    assert all(f"Page {index + 1}" in page.extract_text() for index, page in enumerate(reader.pages))
    if target := os.environ.get("FIELDSIGHT_QA_PDF_PATH"):
        Path(target).parent.mkdir(parents=True, exist_ok=True)
        Path(target).write_bytes(response.content)
    assert (
        client.get(
            f"/projects/{project}/report.pdf?date_from=2027-01-01&date_to=2026-01-01", headers=headers
        ).status_code
        == 422
    )
    assert client.get(f"/projects/{uuid4()}/report.pdf", headers=headers).status_code == 404
    assert client.get(f"/projects/{project}/report.pdf").status_code == 401


def test_pdf_long_qualitative_narrative_flows_across_pages(sync_client):
    client, _, project, headers = sync_client
    identifier = client.post(
        f"/projects/{project}/indicators",
        headers=headers,
        json={"name": "Qualitative findings", "code": "TEXT", "unit": "text", "manual_aggregation": "latest"},
    ).json()["id"]
    narrative = ("Evidence <verified> & reviewed with the field team. " * 75) + "END-OF-EVIDENCE"
    response = client.post(
        f"/indicators/{identifier}/collected-results",
        headers=headers,
        json={"result_date": "2026-10-01", "narrative": narrative},
    )
    assert response.status_code == 201, response.text
    response = client.get(f"/projects/{project}/report.pdf", headers=headers)
    assert response.status_code == 200
    reader = PdfReader(io.BytesIO(response.content))
    text = "\n".join(page.extract_text() for page in reader.pages)
    assert "END-OF-EVIDENCE" in text and "<verified> & reviewed" in text
    assert "Missing: 0" in text
    if os.environ.get("FIELDSIGHT_QA_PDF_PATH"):
        path = Path("../tmp/pdfs/long-narrative.pdf")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
