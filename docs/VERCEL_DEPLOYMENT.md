# FieldSight frontend on Vercel

Use the existing GitHub repository `gabkoi21/Field-Sight` and keep the backend on FastAPI Cloud.
Neon connection credentials and backend secrets must remain in FastAPI Cloud.

## Project settings

| Setting | Value |
| --- | --- |
| Root Directory | `fieldsight-frontend` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js | 22.x or 24.x |
| Production Branch | Repository default branch (`main`, if configured as default) |
| `VITE_API_URL` | `/api` |
| `VITE_SKIP_LOGIN` | `false` (or remove it) |

Set frontend variables for Production and any Preview deployments you intend to test. Changing a
Vite variable requires rebuilding/redeploying the frontend. Never add database URLs, JWT secrets,
or Kobo encryption keys to Vercel's browser-visible `VITE_` variables.

## Backend prerequisite

The Vercel rewrite in `fieldsight-frontend/vercel.json` forwards `/api/:path*` to
`https://fieldsight-backend-574c0305.fastapicloud.dev/:path*` before the SPA fallback.
This keeps browser requests on the frontend's origin and preserves the existing `/api` client base URL.

Deploy the current backend code and set this non-secret FastAPI Cloud variable:

```text
FIELDSIGHT_REFRESH_COOKIE_PATH=/api/auth
```

The backend uses this path for both setting and clearing the refresh cookie. Without it, a cookie
scoped to `/auth` will not be sent by browsers to `/api/auth/refresh`. Keep the local backend's
default `/auth` path; Vite's development proxy already rewrites that cookie path.

Add the final frontend HTTPS origin (without a trailing slash) to `FIELDSIGHT_CORS_ORIGINS` in
FastAPI Cloud, retaining other origins still in use. The existing JWT and Kobo secrets stay there.

## Verify after deployment

1. Open the Vercel URL and a nested application URL directly; both should load the SPA.
2. Request `/api/health/ready`; expect `{"status":"ok","database":"ready"}`.
3. Sign in and confirm the migrated organizations/projects are visible.
4. Reload the page and confirm the session is restored through `/api/auth/refresh`.
5. Sign out and confirm refresh no longer restores the session.

API readiness does not establish that the separate Kobo synchronization worker is hosted. That
process still needs a continuously running deployment connected to the same Neon database.
