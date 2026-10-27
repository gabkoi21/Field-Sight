"""Offline pilot safety guards and reconciled School Feeding calculations."""

import io
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlmodel import Session, create_engine

from app.db.session import get_session
from app.main import create_app
from scripts import school_feeding_pilot as pilot


def test_seed_refuses_production_outside_paths_and_existing_files(tmp_path, monkeypatch):
    monkeypatch.setattr(pilot, "PILOT_ROOT", tmp_path)
    target = tmp_path / "new.db"
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="exactly test"):
        pilot.seed_database(target)
    assert not target.exists()
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    with pytest.raises(ValueError, match="under workspace tmp"):
        pilot.seed_database(tmp_path.parent / "outside.db")
    target.write_bytes(b"existing-data-must-remain")
    with pytest.raises(ValueError, match="already exists"):
        pilot.seed_database(target)
    assert target.read_bytes() == b"existing-data-must-remain"


def test_school_feeding_seed_review_results_dashboard_and_pdf_reconcile(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(pilot, "PILOT_ROOT", tmp_path)
    monkeypatch.setenv("FIELDSIGHT_ENVIRONMENT", "test")
    monkeypatch.setenv("FIELDSIGHT_DATABASE_URL", "sqlite:///unused-pilot-test.db")
    monkeypatch.setenv("FIELDSIGHT_JWT_SECRET", pilot.TEST_SECRET)
    result = pilot.seed_database(tmp_path / "school.db")
    engine = create_engine(
        pilot.pilot_settings(tmp_path / "school.db").database_url, connect_args={"check_same_thread": False}
    )

    def session() -> Iterator[Session]:
        with Session(engine) as db:
            yield db

    app = create_app(pilot.pilot_settings(tmp_path / "school.db"))
    app.dependency_overrides[get_session] = session
    with TestClient(app) as client:
        login = client.post("/auth/login", json={"login": result["officer"], "password": pilot.PILOT_PASSWORD})
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        project = result["project_id"]
        records = client.get(f"/submissions/page?project_id={project}", headers=headers).json()
        assert records["total"] == records["counts"]["needs_review"] == 6
        before = client.get(f"/projects/{project}/indicators", headers=headers).json()
        assert all(item["current_value"] is None for item in before)
        for record in records["items"]:
            detail = client.get(f"/submissions/{record['id']}", headers=headers).json()
            decision = "invalid" if record["external_id"] == "SYNTHETIC-5" else "ready"
            response = client.patch(
                f"/submissions/{record['id']}/review-status",
                headers=headers,
                json={
                    "status": decision,
                    "note": "Synthetic protocol review",
                    "evidence_fingerprint": detail["evidence_fingerprint"],
                    "expected_review_token": detail["review_token"],
                },
            )
            assert response.status_code == 200, response.text
        items = client.get(f"/projects/{project}/indicators", headers=headers).json()
        expected = {"PORTIONS": 365, "SESSIONS": 4, "MEALS": 445}
        assert {item["code"]: item["current_value"] for item in items} == expected
        for item in items:
            assert item["eligible_records"] == 5 and item["quality_excluded_records"] == 1
            current = client.get(f"/indicators/{item['id']}", headers=headers).json()
            assert current["current_value"] == expected[item["code"]]

        class PilotClock(datetime):
            @classmethod
            def now(cls, tz=None):
                return datetime(2026, 10, 27, tzinfo=UTC)

        monkeypatch.setattr("app.routes.collection.datetime", PilotClock)
        dashboard = client.get(f"/dashboard/overview?project_id={project}&period=30d", headers=headers).json()
        assert dashboard["ready_records"] == 5 and dashboard["invalid_records"] == 1
        pdf = client.get(f"/projects/{project}/report.pdf?date_from=2026-10-01&date_to=2026-10-31", headers=headers)
        assert pdf.status_code == 200
        content = " ".join(page.extract_text() for page in PdfReader(io.BytesIO(pdf.content)).pages)
        assert "365" in content and "445" in content and "unique beneficiaries" in content
        csv = client.get(f"/submissions/export.csv?project_id={project}&review_status=ready", headers=headers)
        assert csv.status_code == 200 and len(csv.text.strip().splitlines()) == 6
        summary = client.get(f"/projects/{project}/actions", headers=headers).json()
        assert summary["total"] == summary["summary"]["overdue"] == 0
        assert client.get(f"/projects/{result['other_project_id']}/actions", headers=headers).json()["total"] == 0
    engine.dispose()
