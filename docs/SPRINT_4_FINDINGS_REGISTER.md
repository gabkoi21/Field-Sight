# Sprint 4 — findings register

| ID | Severity / impact | State and evidence | Owner | Reproduction / release gate |
|---|---|---|---|---|
| F01 | P1 hosted release unknown | Starting dev SHA has failed Vercel status; detailed build logs unavailable | Deployment owner | Inspect Vercel deployment Enfrw6wd7jWMmdxLUkkbfbkuoQqk; confirm root, environment, CORS and worker. Blocks hosted release |
| F02 | P1 integration unverified | Live Kobo test credentials/form unavailable; offline/mocked worker tests pass | NGO test administrator | Connect designated test form; verify worker sync, changed evidence, retries. Blocks live pilot |
| F03 | P1 human usability unverified | No actual practitioner sessions | NGO pilot owner | Run UAT checklist with project officer and M&E professional. Blocks NGO acceptance |
| F04 | P1 historical backup exposure | Two local database snapshots were tracked in prior Git history; current tracking removed, local files preserved | Repository/security owner | Assess repository access and snapshot contents privately; rotate any actually exposed credentials through authorized procedure. No values printed or secrets rotated here |
| F05 | P2 third-party provenance | Metrica mirror has no located license evidence; unused by src and excluded by .vercelignore | Repository owner | Establish license/provenance before redistributing mirrored assets; do not delete referenced assets blindly |
| F06 | P2 production DB compatibility | SQLite migration, rollback guard and concurrency tested; PostgreSQL execution not available | Backend owner | Run same tests on disposable PostgreSQL before that deployment |
| F07 | P2 coarse role model | Organization admin manages review/actions; enumerators remain excluded | Product/security owner | Design scoped officer/reviewer/assignee roles before opening portal permissions |
| F08 | P3 Windows install contention | Original npm ci hit locked esbuild; clean isolated install/build/test pass | Local developer | Stop only intended dev processes before reinstall, or use fresh checkout. Does not justify terminating unrelated processes |
| F09 | P2 dependency vulnerabilities | RESOLVED: initial npm audit 6 (2 moderate, 2 high, 2 critical), patched toolchain/transitives now 0 | Engineering | Vite 6.4.5, Vitest 5.0.5; Node engine declared; fresh lockfile install and regression evidence in report |
| F10 | P3 bundle size | Build passes with existing large application chunk warning | Frontend owner | Consider measured route/chunk splitting; no fake completion claim or blocking runtime failure |
| F11 | P3 dependency/deprecation warnings | Backend Pydantic/Starlette/Alembic warnings remain; Recharts 2 is deprecated | Engineering | Plan separate compatibility maintenance with focused regression tests |

Vercel status evidence: https://vercel.com/gabkoi21s-projects/fieldsight/Enfrw6wd7jWMmdxLUkkbfbkuoQqk
GitHub returned no workflow runs for the starting dev/main SHAs inspected. Verify
now runs on future dev pushes, PRs and main. No push was made during this work,
since connected hosting may automatically deploy a pushed branch.

Dependency update basis: official Vitest 5 migration guide
https://vitest.dev/guide/migration/ and current npm registry engine/peer metadata.
The upgrade was first tested in isolation; no tests were weakened to pass it.

Pilot readiness: PARTIALLY VERIFIED locally; live NGO pilot acceptance is NOT READY
until F01–F04 and practitioner sign-off are resolved by the responsible owners.
