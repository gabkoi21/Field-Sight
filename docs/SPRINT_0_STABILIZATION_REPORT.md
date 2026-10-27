# Sprint 0 — stabilization report

Baseline: dev 888efe9434a4e4d8ea14e7305bf4bde04e8934fc. See FIVE_SPRINT_BASELINE_AUDIT.md.

Ruff: 24 errors before, zero after import fixes and formatting in eight scripts/tests.
Mypy: passes, 51 source files. Pytest: 243 passed, 222 warnings, 381.32 seconds.
Disposable Alembic upgrade to 0029_auth_lifecycle passes. Active database untouched.
Frontend: original npm ci blocked by Windows EPERM on running esbuild; isolated
locked install passes. First parallel test run: 116 passed, 3 failed (timeouts);
single-worker rerun is the reproducible verification command. Production build
passes; existing large-chunk warning remains. Full logs are local under tmp/sprint0-*.

Cleanup: 8,292 generated paths removed from Git index only (node_modules, Python
caches, disposable tmp outputs); local copies retained. Three protected .agents
candidates excluded. Starting tracked count 9,188; resulting count 896 before new
documentation. Exact local inventory: tmp/sprint0-untrack-inventory.txt. No source
or intentional fixtures removed. No active DB migration or deletion performed.

Metrica/theme mirror has no located license evidence and no source/index.html
references. Retained pending provenance verification; do not redistribute it as
licensed application source without establishing rights. It is outside Vite src.
No tracked .env found by audit; credential values were not read or printed.

Deployment gate: NOT AUTHORIZED. Root verify runs PR/main; deploy runs main after
verification. Vercel uses frontend root, npm run build, dist, SPA rewrites. Confirm
VITE_API_BASE_URL, backend explicit HTTPS CORS, auth cookie routing, dashboard
branch settings and separate worker supervision before release. Hosted Vercel logs
and account configuration are unavailable here; hosted status is UNVERIFIED.
Inspect GitHub Actions for the exact dev SHA and Vercel project deployment logs.
API-only FastAPI Cloud deployment does not establish worker deployment.

Local start: backend python -m scripts.start_local (see backend README for the
current launcher); alternatively uvicorn app.main:app and python -m app.core.sync_worker
in separate terminals. Existing running services were not interrupted. Runtime
imports exercised through pytest; no active-service smoke test claimed.


Final Sprint 0 frontend verification: 119 tests passed in 24 files with --maxWorkers=1 (134.94s). No test assertions were weakened. Disposable migration and post-fix Ruff/mypy pass.
