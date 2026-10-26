# Authentication lifecycle repair

## Confirmed cause and contributing defects

A real Chromium browser, using a disposable account and database, reproduced the original hostname setup: a page on `localhost` posting directly to `127.0.0.1` received login 200, followed by refresh 401. The fixture observed a missing refresh cookie on that refresh request. This is a cross-site cookie-delivery failure with the existing `SameSite=Lax` cookie; enabling CORS credentials alone does not make the cookie eligible. Testing used ports 5174/8001 to avoid the running application; hostname and cookie semantics match 5173/8000. The fixture's explicitly marked legacy mode emulates the old CORS-only origin policy.

Independent code defects amplified the problem: any non-success refresh logged the user out; rotation revoked access-token session IDs immediately; tabs rotated independently; startup skipped cookie restoration and treated unavailable `/auth/me` as signed out.

## Changes

- The client defaults to `/api`. Vite proxies every `/api/*` route, strips the prefix, and rewrites cookie Path `/auth` to `/api/auth`, leaving frontend navigation untouched.
- Refresh cookies remain host-only, HttpOnly and SameSite=Lax, with Secure in production. Remembered cookies persist for the remaining absolute 14-day session lifetime; session-only cookies omit Max-Age/Expires and access tokens use sessionStorage. Remembered access tokens use localStorage. Refresh responses carry the authoritative persistence mode.
- The production access lifetime remains 15 minutes. Renewal preserves the session family's access-token identity, so another tab's unexpired access token remains valid. Expiry, logout, password change, inactive accounts and replay still invalidate access.
- Atomic family locking serializes backend rotations. For 60 seconds after rotation, a retry can recover the same successor via a domain-separated keyed derivation; no raw refresh token is stored. This covers competing requests and a lost Set-Cookie response without issuing independent successors. Reuse beyond that fixed window revokes the family. Renewal never extends the family's original 14-day expiry.
- Browser Web Locks serialize refresh/login/logout; BroadcastChannel distributes only access tokens and persistence mode. Storage generations propagate logout and reject stale results, including when a tab wakes after missing a broadcast. Browser-managed locks release on tab closure; queued lock acquisition has a timeout.
- Same-tab refresh is deduplicated. Requests time out after 12 seconds; refresh retries at most four times with exponential backoff and jitter, honors Retry-After, and shares cooldown across tabs. 429, 5xx, timeout and network failures preserve credentials and surface an unavailable/retry state. 401 requires sign-in; 403 remains a separate authorization denial.
- Startup restores from the cookie even without stored access, renews expired tokens, and shares its startup promise across StrictMode effects. Protected routes pause while checking/unavailable. Failed unsafe mutations are never automatically replayed; mutations submitted while session state is unresolved are rejected for deliberate resubmission.
- Logout establishes a durable local barrier immediately, then serializes server revocation after any in-flight refresh. Offline server logout remains pending and is retried on reconnect, startup, or before the next sign-in. Account changes and logout cancel/clear user query caches. Request results are checked against the session generation before delivery.
- Refresh diagnostics record only sanitized rejection reasons and generated request correlation IDs. Cookie endpoints validate Origin and reject browser cross-site requests. No credential values are logged.
- Migration `0029_auth_lifecycle` adds family/persistence/rotation metadata without changing existing users, permissions, or existing session credentials. Legacy sessions retain their previous persistence default.

## Configuration

Run `alembic upgrade head` using the normal database migration procedure before starting the updated backend. This task ran migrations only on disposable test databases; it did not migrate the existing local database.

For local development, keep the API on `127.0.0.1:8000`, open the frontend on `localhost:5173` (or consistently on `127.0.0.1:5173`), and leave `VITE_API_URL` unset or `/api`. Remove an old build-time direct-IP override and restart Vite/rebuild the frontend if necessary.

Production hosting must provide the same `/api` reverse proxy, strip `/api` before forwarding, preserve Set-Cookie, and rewrite `/auth` cookie paths to `/api/auth`. For nginx, the key behavior is `location /api/ { proxy_pass http://backend/; proxy_cookie_path /auth /api/auth; }`, together with the deployment's normal HTTPS/header configuration. Production defaults remain Secure and explicit HTTPS CORS origins. Set `FIELDSIGHT_CORS_ORIGINS` to the trusted web origin(s). `vite preview` and static hosting do not supply the development proxy automatically.

A direct API on a different origin is supported only when same-site, with explicit trusted CORS origins and credentials. Cross-site production cookie authentication is deliberately unsupported by this change; it needs a separate CSRF/cookie-restrictions design, not a SameSite=None switch.

Session coordination requires Web Locks in a secure context (HTTPS or loopback); BroadcastChannel provides immediate renewal propagation. Browsers without Web Locks surface an unavailable error instead of performing uncoordinated refreshes. Browser session-restore settings can preserve session cookies and sessionStorage after restart; "session-only" follows the browser's session definition.

## Verification

- Focused backend authentication, migration, permission and administration tests: 23 passed, including concurrent rotation, bounded replay recovery, password-change revocation, inactive users, cookie attributes, sanitized diagnostics, and preservation of legacy users/sessions.
- Frontend authentication regressions: 19 passed. Coverage includes cookie-only/expired-token restoration, StrictMode, scheduled refresh, remembered/session-only storage, 503/429/network/actual timeout recovery, Retry-After/cooldown, same-tab and two-tab deduplication, logout during refresh, sleep/wake, public routes, unsafe mutation replay prevention, and cache isolation across users.
- Frontend production build passes; only the existing large-chunk advisory remains. Backend mypy passes all 51 application files. Ruff passes changed application/migration files; full application lint reports two unrelated long lines in `app/routes/indicators.py` (191 and 712).
- Full backend suite: 210 passed, 4 failed in indicator/manual-results behavior (`test_indicators`, `test_saved_dashboards`, two `test_workspace` cases), after successful authorization. Full frontend run with two workers: 79 passed, 3 failed in indicator Save/mapping expectations; authentication tests passed. These failures were left outside the authentication scope. A prior unrestricted parallel frontend run also had timing-sensitive UI failures.
- Real browser verification confirmed original direct routing login 200/refresh 401 with a missing cookie, proxy login and repeated scheduled renewals across the shortened test boundary, authenticated API access afterward, HttpOnly invisibility to JS, session-only versus remembered storage, cookie-only restoration after reload, two-tab renewal propagation, and logout propagation. Browser fixture uses 65-second access tokens only; production remains 15 minutes.

Remaining verification limits: no actual browser restart, OS sleep, 14-day wall-clock wait, production HTTPS deployment, or PostgreSQL concurrency run was performed. Controlled tests cover expiry/sleep events and SQLite concurrency. Browser checks use the real API client and cookie handling in an isolated harness; the actual React application also restored that synthetic session and opened the protected super-administration route. Existing user accounts and production data were not used.

## Reproduce the browser check

From the backend, run `.venv/Scripts/python.exe scripts/auth_browser_fixture.py`; each run creates a fresh database under `outputs/` and binds only loopback port 8001. From the frontend, run `npm run dev -- --config tests/browser/vite.config.ts --host 127.0.0.1`. Open `http://localhost:5174/tests/browser/auth.html`. The harness contains only synthetic credentials and reports booleans/statuses/counters, never tokens. Do not run the fixture against an existing database or expose it as a deployed service.
