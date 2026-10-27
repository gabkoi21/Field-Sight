from pathlib import Path
import re

def edit(path, fn):
    p=Path(path); p.write_text(fn(p.read_text(encoding="utf-8-sig")),encoding="utf-8")
def cut(s,a,b):
    start=s.index(a); end=s.index(b,start); return s[:start]+s[end:]

def collection(s):
    s=cut(s,"def _quality_findings(",'@router.patch("/submissions/{submission_id}/review-status"')
    s=cut(s,"                    db.exec(delete(QualityFinding)", "                existing.evidence_fingerprint")
    s=cut(s,'    if payload.status != "ready" and db.exec(select(QualityFinding)', "    submission.evidence_fingerprint")
    s=s.replace("from collections import defaultdict\n","").replace("case, delete, func, update","case, func, update").replace("    QualityFinding,\n","")
    s=s.replace('tags=["Data quality"]','tags=["Submissions"]')
    s=s.replace('"path": "/quality"','"path": "/submissions"')
    return s
edit("fieldsight-backend/app/routes/collection.py",collection)

def overview_tests(s):
    s=s.replace("    QualityFinding,\n","")
    s=re.sub(r"(?m)^( +)db.add\(QualityFinding\([\s\S]*?^\1\)\)\n","",s)
    a=s.index('    quality = client.get('); b=s.index('    sync = client.get(',a); s=s[:a]+s[b:]
    s=s.replace(', f"/quality/queue?project_id={foreign}"', "")
    s=s.replace(', f"/quality/queue?project_id={project}"', "")
    return s
edit("fieldsight-backend/tests/test_project_overview.py",overview_tests)

def evidence_tests(s):
    s=s.replace('client.get(path + "/review", headers=headers).json()', 'stored_review(engine, identifier)')
    s=s.replace('        result = client.post(f"/quality/run?project_id={project}", headers=headers)\n        assert result.status_code == 200\n', "")
    s=s.replace('    result = client.post(f"/quality/run?project_id={project}", headers=headers).json()\n    assert result["needs_review"] == 1 and result["ready"] == 0\n', "")
    s="\n".join(line for line in s.split("\n") if '/quality/queue' not in line and '/quality/run' not in line)
    s=s.replace("and_metadata_only_sync_and_validation", "and_metadata_only_sync")
    s=s.replace("reopens_and_remains_held_after_clean_validation", "reopens_and_remains_held_after_repeat_sync")
    insertion = '''\ndef stored_review(engine, identifier):
    """Inspect retained eligibility/audit persistence without a Data Quality endpoint."""
    with Session(engine) as db:
        row = db.get(Submission, identifier)
        events = db.exec(select(SubmissionReviewEvent).where(SubmissionReviewEvent.submission_id == identifier)).all()
        return {"submission": {"review_status": row.review_status,
                               "evidence_fingerprint": evidence_fingerprint(row.raw_answers)},
                "events": [{"action": event.action, "note": event.note, "actor": "System" if event.actor_id is None else "Administrator",
                            "source": event.source, "previous_status": event.previous_status, "status": event.status}
                           for event in events]}
\n'''
    return s.replace("\ndef sync(",insertion+"\ndef sync(")
edit("fieldsight-backend/tests/test_review_evidence.py",evidence_tests)

def fronttests(s):
    s=s.replace("overviewIssues, reportingCompleteness","reportingCompleteness")
    s=s.replace(" qualityQueue: vi.fn(),","")
    s="\n".join(line for line in s.split("\n") if "apiClient.qualityQueue" not in line)
    s=cut(s,'it("does not infer missing school reports','it("refreshes the saved overview')
    return s
edit("fieldsight-frontend/src/pages/organization/ProjectWorkspacePage.test.tsx",fronttests)

def submission_tests(s):
    s=s.replace("search and review filters","search changes")
    a=s.index('  fireEvent.change(await screen.findByLabelText("Review status filter")'); b=s.index("\n});",a)
    s=s[:a]+'  expect(screen.queryByLabelText("Review status filter")).toBeNull();\n  expect(screen.queryByRole("columnheader", { name: "Review" })).toBeNull();'+s[b:]
    return s
edit("fieldsight-frontend/src/pages/organization/SubmissionsPage.test.tsx",submission_tests)
