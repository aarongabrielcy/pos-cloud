# ADR-013: Admin RBAC Strategy

## Status

Accepted

## Context

CLOUD-01C-A shipped admin identity, login, and session infrastructure but explicitly deferred
authorization: every Customers/Licenses/Installations business route remained unauthenticated, and
only `GET /auth/me` required a Bearer token at all (see
[ADR-012](./ADR-012-admin-authentication-strategy.md#future-hardening-explicitly-out-of-scope-for-cloud-01c-a)).
CLOUD-01C-B closes that gap: it adds Role-Based Access Control on top of the existing `AdminUser`/
access-JWT infrastructure and makes every administrative route deny by default.

The options considered:

**Permission catalog persistence.**

- A. Permissions persisted in and editable via the database (a Permission CRUD).
- B. Permissions defined purely in code, only roles/assignments persisted.
- C (chosen). Hybrid: permission codes are TypeScript constants (the single source of truth for
  `@RequirePermissions(...)`), mirrored 1:1 into a `permissions` table by migration so
  `role_permissions` gets real referential integrity. No endpoint can create a permission - one can
  only enter the system via a deploy (code + migration together).

Option C was chosen because it is the only one that simultaneously satisfies every priority that
mattered for this decision: permissions stay stable (no client can invent one), the mapping is
auditable via plain SQL, the migration story is deterministic, and no permission-CRUD surface has to
be built or defended before anything needs it.

**Where permission resolution happens (JWT vs. database).**

- Roles/permissions could have been embedded in the access JWT itself, or resolved from PostgreSQL
  on every authorization check.
- Chosen: **resolve from PostgreSQL per request**, via one indexed join query
  (`admin_user_roles -> role_permissions`, filtered by `admin_users.status = 'ACTIVE'`).
- This was the _simpler_ option, not the more complex one: embedding roles in the JWT would have
  required redesigning the access token CLOUD-01C-A already shipped, for no strong reason (see
  ADR-012's own claims/TTL decisions, left untouched). A per-request DB lookup gives immediate
  consistency when a role changes and needs no cache (Redis or otherwise) at the admin-user volumes
  this Control Plane actually has.

## Decision

- **Model**: flat RBAC - `AdminUser -(N:N)- AdminRole -(N:N)- Permission`, no hierarchy, no ABAC, no
  per-resource scoping.
- **V1 permission catalog**: 10 codes, one per real use case
  (`customers.read/create/status.change`, `licenses.read/create/status.change/entitlements.manage`,
  `installations.read/create/status.change`) - see
  [admin-rbac.md](../architecture/admin-rbac.md#permission-catalog).
- **V1 roles**: `PLATFORM_VIEWER` (the 3 `*.read` permissions), `PLATFORM_OPERATOR` (every
  permission except `licenses.entitlements.manage`), `PLATFORM_ADMIN` (all 10). `PLATFORM_ADMIN` is
  a normal role with every permission assigned - nothing in the resolver or the guard special-cases
  its name.
- **Default-deny**: a handler with no `@Public()`/`@AuthenticatedOnly()`/`@RequirePermissions()`
  metadata is rejected with 403, even though it is authenticated. The only way to open a route is an
  explicit, greppable decorator - see [admin-rbac.md](../architecture/admin-rbac.md#default-deny).
- **SUSPENDED semantics**: a SUSPENDED AdminUser with a still-valid access JWT resolves to zero
  effective permissions (the resolver's own `WHERE status = 'ACTIVE'`), so every permission-gated
  route responds 403 - `GET /auth/me` is unaffected (it is `@AuthenticatedOnly()`, never resolves
  permissions), matching CLOUD-01C-A's own documented `/auth/me` policy.
- **Administration scope**: the role -> permission mapping is migration-seeded and static in V1, not
  runtime-editable. Only admin -> role assignment is dynamic, and its only real consumer today is
  bootstrap (there is no flow yet to create a second AdminUser) - no HTTP endpoint administers roles
  in CLOUD-01C-B.
- **Bootstrap**: `BootstrapFirstAdminUseCase` grants `PLATFORM_ADMIN` to the admin it creates via
  `AssignRoleToAdminUseCase`; the RBAC migration separately backfills `PLATFORM_ADMIN` onto any
  `admin_users` row that predates RBAC (this repository's own bootstrapped admin from CLOUD-01C-A).

## Trade-offs

- A role/permission change takes effect on the admin's _next_ request (no caching layer to
  invalidate), at the cost of one extra indexed join query per permission-gated request - accepted
  as cheap at Control Plane admin volumes (tens, not millions, of AdminUsers).
- The 403 response body never reveals which permission was missing or whether the cause was
  SUSPENDED vs. a genuinely missing role - deliberate information hygiene, not an oversight; the
  detail is available server-side via `correlationId`.
- `customer-management`/`licensing`/`installations` now depend one-directionally on
  `access-management`'s public `PERMISSIONS`/`RequirePermissions`/guards - the reverse remains
  forbidden (see `.dependency-cruiser.cjs`). This is treated as a platform-capability dependency (the
  same shape every context already has on `shared-kernel`), not a peer bounded-context relationship.

## Future hardening (explicitly out of scope for CLOUD-01C-B)

Role/permission CRUD endpoints, a second-admin creation/invite flow, MFA, rate limiting, immediate
access-JWT revocation, audit event persistence (audit integration _points_ exist - role assignment

- but no store), Redis permission caching, ABAC. See
  [admin-rbac.md](../architecture/admin-rbac.md#non-goals) for the complete list.
