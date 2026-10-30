# FieldSight backend review — 29 October 2026

## Assessment and priorities

The existing architecture is suitable for incremental improvement: an application factory, versioned router assembly, resource routers, separate SQLModel tables and Pydantic input/output schemas, a request-scoped session dependency, and Alembic migrations. Synchronous HTTP operations correctly use synchronous endpoints; asynchronous middleware and exception handlers do not perform database work. Retain this structure.

Authentication uses Argon2 passwords, signed access tokens tied to persisted refresh sessions, refresh-token hashing and rotation, revocation, cookie origin checks, and workspace role checks. Organization/project helpers enforce tenant scope. Kobo credentials are encrypted and public connection responses use explicit schemas. Submission downloads validate pagination URLs, repeated pages, record identities, and totals. Sync preserves atomic submission updates and safe failure history; the worker uses database queue claims and retries. Analytics excludes unapproved evidence; saved dashboard sources are checked against both organization and project, with optimistic version checks on updates.

Priority findings before implementation:

1. Submission sync performed one lookup per downloaded record. This adds database round trips and autoflush overhead as imports grow.
2. Historical-form catalogue construction loaded all project answers before selecting a form. Only form identities are needed for the catalogue's form list.
3. `/auth/me` queried organization names individually and included memberships belonging to disabled organizations.
4. Kobo token verification and form helpers accepted redirects as success; malformed form-list responses could silently appear empty, while malformed JSON could escape as an unexpected exception. A redirect from remote deletion could also allow the caller to continue as if deletion succeeded.

## Implemented changes

| File | Change |
| --- | --- |
| `fieldsight-backend/app/api/v1/router.py` | Keep authentication tags on the authentication router itself, avoiding duplicate tags during assembly. |
| `fieldsight-backend/app/routes/collection.py` | Fetch existing submissions in batches of at most 400 identities, scoped by organization, project, and form. Keep an identity map for incoming records. Preserve evidence comparisons, review invalidation, sync counts, and transaction boundaries. |
| `fieldsight-backend/app/routes/analysis.py` | Select distinct historical form identities in SQL, then load answers only for the selected form. Preserve the existing form list, catalogue, and result contracts. |
| `fieldsight-backend/app/routes/auth.py` | Use reusable `Annotated` database/configuration dependencies and annotated headers/cookies. Join organizations into the membership response query and omit disabled organizations. Declare authentication tags on the router. |
| `fieldsight-backend/app/core/kobo.py` | Require successful HTTP status codes for form helpers; reject invalid JSON, non-object responses, and invalid asset lists using safe errors. Do not follow redirects. |
| `fieldsight-backend/tests/test_kobo_sync.py` | Add measured query-count coverage for an 801-record initial and repeat import. |
| `fieldsight-backend/tests/test_auth_lifecycle.py` | Add disabled-organization filtering and sensitive-field regression coverage. |
| `fieldsight-backend/tests/test_kobo_provider_errors.py` | Cover redirects, malformed provider JSON, invalid asset lists, and remote deletion redirects. |
| `fieldsight-backend/tests/test_local_launcher.py` | Isolate launcher lifecycle tests from the real port 8000 check introduced by a concurrent workspace change, and verify an occupied port starts no services. Preserve the launcher implementation. |

No database migration, dependency upgrade, frontend edit, or production-data operation is part of this change. Pre-existing super-admin changes and other concurrent workspace edits are outside this review's changes.

## Verification

Tests use disposable SQLite databases and mocked provider HTTP; they do not verify a live Kobo service or production PostgreSQL.

- Full backend suite executed: **293 passed, 2 failed, 247 warnings**, in 363.65 seconds. Both failures were launcher lifecycle tests encountering the real occupied local port 8000 after a concurrent launcher change introduced a bind check. See `outputs/backend-review-diagnostic.log`.
- After isolating that socket check and adding occupied-port coverage, the complete launcher test module was rerun: **4 passed** in 1.15 seconds. See `outputs/backend-review-launcher-tests.log`. All current tests are covered by the full run plus this focused rerun; the entire suite was not rerun after the launcher-test-only correction.
- The new measured sync regression also passed independently: an 801-record initial import and unchanged repeat each execute **3 submission SELECTs**. Existing 1,500-record sync, rollback, tenant isolation, automatic sync, indicator calculations/targets, saved dashboards, report exports, and workspace regression modules passed in the full run.
- Ruff passed on all changed Python files; `git diff --check` reported no whitespace errors. Git emitted line-ending conversion notices for unrelated workspace edits.
- Initial sandbox attempts could not create pytest temporary directories or the Windows event-loop local socket pair. Aborted runs are not counted as successful verification. The completed suite ran with a sandbox exception and a workspace temporary directory; provider HTTP remained blocked by the test fixture.
- Existing warnings include Alembic configuration deprecations and Pydantic enum serialization warnings. These deserve a separate compatibility cleanup; they were not suppressed or treated as failures here.

## Remaining recommendations

- Add complete, bounded asset-list pagination to Kobo form discovery; the existing helper reads the first asset page only. Validate every next URL before forwarding credentials, as submission downloads already do.
- Profile indicator lists and dashboard widgets: repeated mapping/schema/submission retrieval remains in per-indicator calculations. Introduce request-local shared data only with evidence-equivalence tests, especially for historical forms and review status.
- Large submission downloads, analytics, and exports still materialize data in memory. Plan bounded processing and streaming with explicit transaction/error semantics, rather than changing response shapes in a cleanup.
- Existing list APIs retain their contracts. Introduce pagination through an explicit compatible API plan; enumerator serialization still has per-account lookups.
- SQLModel table classes remain public response types on some APIs. Add dedicated public response schemas incrementally before sensitive model fields are introduced. `/auth/me` still uses an explicit safe dictionary with a broad response type.
- Shared authentication and session aliases remain duplicated across routers. Consolidate them when route-to-route authorization helpers are moved into a dependency/service module; avoid a broad import-graph rewrite now.
- Check production PostgreSQL plans and concurrency separately. Existing submission identity uniqueness and organization/project/date indexes already support these access patterns; no additional index is justified without query-plan evidence.
- Keep unexpected exception logs under review: traceback logging can contain SQL exception details. Test log redaction before adding additional diagnostic logging around provider credentials or submitted answers.

This is a targeted engineering review and regression pass, not a certification of every endpoint or a production load test. The supplied FastAPI skill was read; its referenced `references/` directory was not provided. Optional newer framework features were not introduced or dependencies upgraded merely to match examples.
