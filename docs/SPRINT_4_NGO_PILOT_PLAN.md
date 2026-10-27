# Sprint 4 — NGO pilot plan

Outcome: PARTIALLY VERIFIED. Local synthetic automation and authenticated browser
smoke are verified. Live Kobo integration, hosted release validation and interviews
with actual practitioners remain Pending external validation. No production
release or NGO acceptance is asserted.

## Safe local pilot

Prerequisites: Python 3.12 backend environment; Node 22.12+ in the supported 22/24
release lines (see frontend package engines); installed locked dependencies.
From fieldsight-backend in PowerShell:

```powershell
$env:FIELDSIGHT_ENVIRONMENT = 'test'
.\.venv\Scripts\python.exe -m scripts.school_feeding_pilot --database ..\tmp\my-new-school-pilot.db --serve
```

The seed requires environment exactly test, a new .db under workspace tmp, and
exclusive file creation. It refuses production, outside paths and existing files,
including empty files. Failed partial seeds are never overwritten. It upgrades
only this newly reserved disposable DB, seeds explicitly labelled synthetic data,
and optionally serves it on 127.0.0.1:8001. It never reads the active project's DB.
The offline Kobo connection is unverified with a dummy token; it cannot silently
synchronize real external data. No automatic action or success activity is seeded.

In another PowerShell terminal, from fieldsight-frontend:

```powershell
npm ci
$env:VITE_API_URL = 'http://127.0.0.1:8001'
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open http://127.0.0.1:5174 . Synthetic users: officer@pilot.example and
reviewer@pilot.example, password SyntheticPilot123! . These credentials are
fixtures only. The collector is a project assignment and cannot use the admin
portal. Never reuse the test secret, password or seed in a deployed environment.
Choose SYNTHETIC — Daily School Feeding Monitoring Form. Select the other
synthetic project to confirm project isolation. Stop both test terminals when done.

For this session, the actual browser used tmp/school-feeding-browser-20261027.db
and the isolated frontend tmp/frontend-sprint-verify. The active user DB and
existing API/worker services were not migrated or stopped.

## Repeatable task protocol and expected values

The six dated October 2026 scenarios cover three synthetic schools, served yes/no,
shortage yes/no, zero, missing portions and an invalid numeric answer. Record grain
is one school-day monitoring record. It is not a verified unique service session
without an upstream uniqueness contract, and student-meal instances are not unique
beneficiaries. No expected-school roster/schedule exists: completeness is unknown.

1. Observe six pending records and no eligible indicator values before review.
2. Inspect every answer. Mark SYNTHETIC-5 Invalid with a reason; mark the other
   five Ready. All decisions must use current evidence/review tokens.
3. PORTIONS sums 215 + 100 + 0 + 50 = 365; the missing answer is not zero.
4. SESSIONS counts four eligible school-day records reporting served=yes.
5. MEALS sums 215 + 100 + 0 + 80 + 50 = 445 student-meal instances.
6. Compare indicator register/detail and named-period October PDF. Operational
   dashboard counts five ready and one invalid. Filtered ready CSV has five rows;
   raw CSV is an evidence export, not a calculated indicator-results export.
7. Create a follow-up manually from SYNTHETIC-1; assign an eligible project member,
   choose high priority and a past date. Move Open → In progress → Resolved with
   summary → Closed with officer verification note. Reload and inspect audit.
8. Switch projects, try foreign evidence and stale versions; expect no data leak
   and clear 404/422/409 responses. Archive a test project; action history stays
   readable, while new actions/edits are denied.

Automated test_school_feeding_pilot.py freezes the dashboard's clock to October
27 for repeatability; other tests use actual UTC dates for overdue calculations.
Test_review_evidence.py and test_automatic_sync.py cover changed answers reopening
review, metadata-only/idempotent imports, duplicate imports, provider failure,
retries and transaction rollback. The seed itself makes no provider requests.

## Designated Kobo test environment (external validation pending)

An administrator must supply an authorized test account/form, separate from live
programme data. Connect it through existing Forms/Kobo connection controls, verify
it, assign its form to a designated test project and cache its schema. Start API
and python -m app.core.sync_worker against the same explicitly selected test DB.
Do not use the offline seed's dummy token as a live integration.

Submit served/no, shortage/no, missing, invalid, repeated school/date and changed
answers in the designated Kobo form. Queue sync in FieldSight, inspect worker
heartbeat and Sync runs, then repeat review and mapping through the UI. Reimport
unchanged records and confirm no duplicate answers or review events. Simulate
network failure only against the test provider, recover it and confirm retry.
No credentials or real form were available for this step; no external data changed.

## Operations, recovery and support

Local development: python -m scripts.start_local starts API and worker together
in development mode, stopping both if either exits. In a test environment use
separately supervised API and python -m app.core.sync_worker. API deployment alone
does not establish a worker. Check shared DB/settings, worker heartbeat, pending
job age, latest status, retry attempts and error/request IDs. Do not equate a
heartbeat to successful collection. Restart workers after backend code changes.

Before an authorized active-environment upgrade: schedule a write freeze, stop
API/worker writers, take a consistent SQLite backup using sqlite3.Connection.backup
(or a PostgreSQL-native backup), verify integrity and a restore to a disposable
copy, record code SHA and Alembic revision, and test upgrade on the copy. Only then
may an authorized operator upgrade the active DB. Keep encrypted, access-controlled
backups outside Git. Never copy a live SQLite .db while ignoring its WAL state.

Recovery: preserve logs and failed-job evidence, stop writers, restore a verified
backup with matching code/revision in isolation, compare counts/audit history and
replay only authorized test imports. 0030 populated downgrade refuses history loss;
do not bypass it or reset the DB. Escalate any lost decisions or tenant access
failure to the project owner before reopening writes. No recovery on user data was
performed here; migration/preservation/rollback tests use disposable DBs only.

Support escalation should include code SHA, sanitized request ID, timestamps,
project reference, retry state, repro steps and business impact. Exclude tokens,
passwords and raw sensitive survey answers from public tickets.

## Release gate

Local automation, migration preservation, tenant denial and authenticated synthetic
smoke pass. Deployment remains unauthorized. Live Kobo, hosted environment checks,
backup-history exposure review, theme licensing confirmation and actual project
officer/M&E usability sign-off remain external gates. See UAT checklist and findings.

Final Sprint 4 verification: 254 backend tests passed (233 warnings, 468.91s); fresh npm ci passed, 127 frontend tests passed across 26 files (306.91s), production build passed (15.24s), npm audit 0. Runtime toolchain was patched to Vite 6.4.5 / Vitest 5.0.5 after compatibility review. Verification now includes dev pushes; deployment still only targets main and was not run. Authenticated synthetic browser results and screenshots are in SPRINT_4_UAT_CHECKLIST.md.
