# Five sprint baseline audit — 2026-10-27

Requested source: Downloads/FieldSight_Codex_5_Sprint_Implementation_Plan.md,
read in full. The user authorized sequential implementation, data preservation,
verification, and reporting; deployment and merging main remain unauthorized.

Initial checkout: main at 010ba5445b230016dc75d02fc6d40385273bbd49.
Working branch: dev at 888efe9434a4e4d8ea14e7305bf4bde04e8934fc.
Switch completed without resetting or stashing. Initial status reported 620
deletions alongside permission errors on generated test databases. These were
not assumed to be intentional deletions and no local data was removed.
No tracked AGENTS.md was found.

Baseline diagnostics: Ruff 24 errors (13 import fixes, 11 formatting errors);
mypy passes (51 source files). Full pytest running with disposable basetemp.
Original frontend npm test cannot spawn esbuild in the sandbox. Elevated npm ci
fails EPERM unlinking the existing esbuild executable. Verification therefore
uses an isolated frontend copy under tmp, without stopping existing app processes.

Preserve: tenant-admin backend authorization; evidence fingerprint v1; persisted
SubmissionReviewEvent history; changed-evidence review holds; ready-only indicator,
dashboard and report calculations; saved dashboards; framework and Kobo worker.
Reuse: collection routes, SubmissionEvidence, shared MetricCard, project workspace,
project team membership, existing API client, and the linear Alembic history.
No equivalent project action register was found in the existing routes/models.

Audit found 9,188 tracked files, including 8,295 generated candidates (7,495 in
outputs, 779 in tmp, 18 backend caches, 3 under protected .agents). Protected skill
files are excluded from cleanup. Inventory retained locally in
tmp/sprint0-untrack-inventory.txt. Cleanup changes Git tracking only.

Deployment: verify.yml runs on PR/main, deploy.yml deploys main only after reusable
verification. Vercel frontend config builds dist and rewrites SPA routes. Hosted
Vercel settings/logs and real credentials have not been verified. A local pass
cannot establish hosted success. Existing .env and active SQLite files are never
read for values, modified, reset, or migrated by this assignment.
