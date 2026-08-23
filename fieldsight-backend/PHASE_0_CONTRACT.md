# Phase 0 — Architecture and API contract

**Status:** complete on 2026-08-23

This is the approved contract for Phase 1 implementation. It turns the decisions in `IMPLEMENTATION.md` into unambiguous scope boundaries for the first backend build.

## 1. Fixed technology decisions

| Concern | Decision for the current build |
| --- | --- |
| Web API | FastAPI REST API, versioned under `/api/v1` |
| Persistence | SQLModel table models with Alembic migrations |
| Current database | SQLite at `sqlite:///./fieldsight.db` |
| Validation | Pydantic v2 request and response schemas, separate from table models |
| Authentication | Short-lived JWT access token plus rotating refresh-session token |
| Password hashing | `pwdlib.PasswordHash.recommended()` |
| API format | JSON; ISO 8601 UTC timestamps; UUID public IDs; cursor-paginated lists |
| Future database path | PostgreSQL only when SQLite concurrency, reporting/JSON query, worker, or spatial needs justify migration |

SQLite requirements from Phase 1 onward:

- Enable `PRAGMA foreign_keys = ON` for every connection.
- Enable WAL mode and configure a busy timeout for local concurrent reads/writes.
- Use portable SQLAlchemy `JSON` columns, not database-specific `JSONB` types.
- Keep filter/sort fields as typed indexed columns; do not make application queries depend on SQLite JSON querying.
- Use a file-backed temporary SQLite database for API integration tests, not `:memory:` where multiple connections are used.

## 2. Authorization contract

There are exactly three roles. The legacy frontend `data_manager` value is renamed to `organization_admin`. `analyst` is out of scope and must not be implemented as a role.

```text
roles
1. super_admin
   └── Controls the FieldSight platform
2. organization_admin
   └── Controls one organization
3. enumerator
   └── Collects field data
```

| Role | Scope | Allowed actions |
| --- | --- | --- |
| `super_admin` | All FieldSight tenants/platform | Create, activate, suspend, restore, and configure organizations; invite organization owners; manage plans/invoices/platform settings; view platform audit and health data |
| `organization_admin` | One organization | Manage profile, sectors, members, enumerators, projects, forms/connections, syncs, review/quality, exports, reports, security/data settings |
| `enumerator` | Assigned project/form/location only | Collect and synchronize permitted field data; view permitted assignments and own work |

Authorization invariants:

1. `super_admin` is a platform role; `organization_admin` and `enumerator` are organization membership roles.
2. Every tenant-owned request must resolve an effective organization from authenticated membership/context, not from an untrusted request body alone.
3. A resource outside the effective organization returns `404`, not a data-revealing `403`.
4. An enumerator must have an active `FieldAssignment` for the target project/form/location before collection access is granted.
5. Every cross-tenant support/switch action is explicit and creates an audit event.

## 3. Sector contract

Sectors are platform catalog values that classify organizational work. The initial seed catalog is:

| Code | Display name |
| --- | --- |
| `health` | Health |
| `education` | Education |
| `agriculture` | Agriculture |
| `wash` | WASH |
| `humanitarian_response` | Humanitarian response |

`Sector` and `OrganizationSector` implement the relationship:

```text
Organization 1 ──< OrganizationSector >── 1 Sector
                      table: organization_sectors

OrganizationSector 1 ──< Project
```

- One organization may have many sectors.
- One sector may be assigned to many organizations.
- `organization_sectors` has `organization_id`, `sector_id`, `is_active`, timestamps, and optional organization-specific metadata.
- It must enforce `UNIQUE (organization_id, sector_id)`.
- A project stores `organization_sector_id`; it may reference only an active link for its own organization.
- Super admins manage the platform sector catalog. Organization admins manage which catalog sectors are active for their own organization. Enumerators cannot manage sectors.

## 4. Initial public API contract

All endpoints live below `/api/v1`. Error response shape:

```json
{
  "code": "resource_not_found",
  "message": "Project was not found.",
  "details": {},
  "request_id": "uuid"
}
```

Cursor-list response shape:

```json
{
  "items": [],
  "next_cursor": null,
  "total": 0
}
```

The first implementation endpoints are:

| Endpoint | Roles | Contract |
| --- | --- | --- |
| `POST /auth/login` | Public | Validate credentials and create an authenticated session/token response |
| `POST /auth/refresh` | Refresh session | Rotate a refresh token and issue a new access JWT |
| `POST /auth/logout` | Authenticated | Revoke the current refresh session |
| `GET /auth/me` | Authenticated | Return user, platform role, memberships, active organization, and effective permissions |
| `GET /sectors` | Authenticated | Return active platform sector catalog |
| `POST /sectors` | `super_admin` | Add a platform sector |
| `PATCH /sectors/{sector_id}` | `super_admin` | Rename/activate/deactivate a platform sector |
| `GET /organizations/{org_id}/sectors` | Organization member/super admin | List assigned organization sectors |
| `PUT /organizations/{org_id}/sectors` | `organization_admin`, `super_admin` | Replace active organization-sector assignments with validated sector IDs |
| `DELETE /organizations/{org_id}/sectors/{sector_id}` | `organization_admin`, `super_admin` | Deactivate/remove a sector only when no active project references it |
| `POST /organizations` | `super_admin` | Create organization, owner invitation, plan, settings, and sector assignments atomically |
| `POST /organizations/{org_id}/members` | `organization_admin`, `super_admin` | Invite member as `organization_admin` or `enumerator` |
| `POST /organizations/{org_id}/projects` | `organization_admin`, `super_admin` | Create a project with an active `organization_sector_id` |

Mutating requests accept an `Idempotency-Key` header where network retries could create duplicate organizations, invitations, assignments, or projects.

## 5. Required first migrations

Phase 1 must create migrations in this dependency order:

1. `users`, credentials, refresh sessions, invitations
2. `organizations`, organization settings, organization memberships
3. `sectors`, `organization_sectors`, including initial sector seed migration
4. `plans`/subscriptions (if included in the first slice)
5. `projects` with `organization_sector_id`
6. audit events

The `OrganizationSector` link is not replaceable with a comma-separated text column or an array on `Organization`.

## 6. Phase 0 acceptance record

Phase 0 is complete when Phase 1 uses this contract unchanged unless a deliberate product decision is documented:

- SQLite is the active database choice.
- The role enum contains only `super_admin`, `organization_admin`, and `enumerator`.
- The sector catalog and `organization_sectors` many-to-many relation are the only sector source of truth.
- New projects require a valid active organization-sector link.
- API errors, list pagination, UUIDs, timestamps, and endpoint namespace follow this document.
- The frontend migration maps `data_manager` display/value to `organization_admin` before real authorization is connected.
