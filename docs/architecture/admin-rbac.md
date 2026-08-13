# Admin RBAC (CLOUD-01C-B)

Extends `@pos-cloud/access-management` (CLOUD-01C-A's admin identity/authentication package) with
Role-Based Access Control and makes every administrative HTTP route deny by default. See
[ADR-013](../adr/ADR-013-admin-rbac-strategy.md) for why each decision below was made; this document
describes what was actually built. Authentication itself (login, JWT, refresh, replay, logout,
lockout, timing mitigation, password hashing, cookies) is unchanged - see
[admin-authentication.md](./admin-authentication.md).

## Permission catalog

10 codes, one per real use case that existed before this task - no permission was invented for an
operation that doesn't exist yet:

| Code                           | Endpoint(s)                                    |
| ------------------------------ | ---------------------------------------------- |
| `customers.read`               | `GET /customers/:id`, `GET /customers`         |
| `customers.create`             | `POST /customers`                              |
| `customers.status.change`      | `PATCH /customers/:id/status`                  |
| `licenses.read`                | `GET /licenses/:id`, `GET /licenses`           |
| `licenses.create`              | `POST /licenses`                               |
| `licenses.status.change`       | `PATCH /licenses/:id/status`                   |
| `licenses.entitlements.manage` | `PUT /licenses/:id/entitlements`               |
| `installations.read`           | `GET /installations/:id`, `GET /installations` |
| `installations.create`         | `POST /installations`                          |
| `installations.status.change`  | `PATCH /installations/:id/status`              |

Defined as TypeScript constants (`PERMISSIONS.CUSTOMERS.READ`, etc. - see `domain/permission.ts`),
the single source of truth for `@RequirePermissions(...)`. Mirrored 1:1 into
`access_management.permissions` by `CreateAccessManagementRbac` so `role_permissions` has real
referential integrity. No endpoint creates, edits, or deletes a permission - a new one can only enter
the system via a deploy (a new constant + a new migration together).

## Roles

| Role                | Permissions                                            |
| ------------------- | ------------------------------------------------------ |
| `PLATFORM_VIEWER`   | the 3 `*.read` permissions                             |
| `PLATFORM_OPERATOR` | every permission except `licenses.entitlements.manage` |
| `PLATFORM_ADMIN`    | all 10                                                 |

`PLATFORM_ADMIN` is a normal role with every permission assigned - there is no `if (role ===
"PLATFORM_ADMIN") return true` anywhere; `AdminAuthorizationGuard` only ever checks resolved
effective permissions. `licenses.entitlements.manage` is the one permission excluded from
`PLATFORM_OPERATOR`: it directly controls which paid features a customer's license grants, a
financially-sensitive lever distinct from day-to-day operations.

## Administration scope

The role -> permission mapping (`role_permissions`) is migration-seeded and static in V1, not
runtime-editable - there is no real use case yet for redefining what `PLATFORM_OPERATOR` means
without a code review. The only dynamic table is `admin_user_roles` (which admin has which role), and
`AssignRoleToAdminUseCase` is its only mutator - today its only caller is
`BootstrapFirstAdminUseCase` (see [Bootstrap](#bootstrap) below), since no flow exists yet to create
a _second_ AdminUser. No HTTP endpoint administers roles, assignments, or permissions in CLOUD-01C-B;
`AssignRoleToAdminUseCase` exists as an internal application-layer use case specifically so a future
admin-management task can reuse it without duplicating its idempotency contract, rather than being
built from scratch then.

## JWT vs. DB lookup

Roles/permissions are **not** embedded in the access JWT. `AdminAuthorizationGuard` resolves an
admin's effective permissions from PostgreSQL on every permission-gated request via
`PermissionResolverPort` / `TypeOrmPermissionResolverAdapter` - one indexed join, no caching, no
Redis. This was the simpler choice, not the more complex one: embedding roles in the JWT would have
required redesigning the access token CLOUD-01C-A already shipped (claims, TTL, re-issuance
semantics) for no strong reason; a per-request DB lookup needs none of that and gives immediate
consistency when a role changes.

## Permission resolver

```sql
SELECT DISTINCT rp.permission_code
FROM access_management.admin_users au
JOIN access_management.admin_user_roles aur ON aur.admin_user_id = au.id
JOIN access_management.role_permissions rp ON rp.role_code = aur.role_code
WHERE au.id = $1 AND au.status = 'ACTIVE'
```

One round trip, regardless of how many roles the admin has (the union of all their roles'
permissions comes back in a single result set). A permission code returned from the database that
isn't in the compiled `PERMISSIONS` catalog throws (fails loudly, becomes a sanitized 500) rather
than being silently granted or silently dropped - see `TypeOrmPermissionResolverAdapter`.

## Suspended semantics

`au.status = 'ACTIVE'` in the query above means a `SUSPENDED` AdminUser resolves to an **empty**
permission set, even if `PLATFORM_ADMIN` is assigned - every permission-gated route responds `403`
for them, indistinguishable in the response body from "authenticated but genuinely lacks the
permission" (see [401 vs. 403](#401-vs-403) below). `GET /auth/me` remains `@AuthenticatedOnly()`
(see [Default-deny](#default-deny)) and is never gated by the resolver - it still returns `200` with
`status: "SUSPENDED"` for a still-valid JWT, exactly as CLOUD-01C-A documented. Since
BACKEND-HARDENING-01 (effective permissions exposure - see
[ADR-016](../adr/ADR-016-openapi-response-contract-and-effective-permissions.md)), `GetAdminProfileUseCase`
_does_ now call `PermissionResolverPort` (the same authority `AdminAuthorizationGuard` uses) to
populate the response's `permissions` field - for a `SUSPENDED` admin this correctly resolves to
`permissions: []`, consistent with (not a new exception to) the empty-set rule above; the request
still succeeds with `200`, it just accurately reports "can do nothing right now."

## Default-deny

Every HTTP handler must carry exactly one of three decorators:

- `@Public()` - no Bearer token required at all (bypasses both guards). Used only for
  `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (each has its own independent
  security mechanism - credentials, or the refresh cookie's own hash comparison) and `HealthController`
  (class-level - Docker's own `HEALTHCHECK` and load balancers send no Authorization header).
- `@AuthenticatedOnly()` - Bearer token required, no specific permission checked. Used only for
  `GET /auth/me`.
- `@RequirePermissions(...)` - Bearer token required AND every listed permission. Used on all 13
  business endpoints.

A handler with **none** of these is rejected with `403` by `AdminAuthorizationGuard`, even though the
caller is authenticated - this is the deliberate fix for "a developer adds a new administrative
endpoint and forgets to annotate it": the endpoint fails loudly on first use/test instead of being
silently reachable by any authenticated admin. `rbac-protection-matrix.spec.ts` (apps/api) asserts
the exact classification of every known handler via `DiscoveryService`, so a permission accidentally
changed, or a new endpoint added without updating that file's table, breaks CI.

## Guards

```
Request -> AccessTokenGuard -> AdminAuthorizationGuard -> Handler
```

Both registered globally via `APP_GUARD` in `ControlPlaneModule` (`useExisting`, reusing the single
instance `AccessManagementModule` already constructs internally - `useClass` would construct a
second, under-provisioned instance unable to resolve `ACCESS_TOKEN_VERIFIER`/`PERMISSION_RESOLVER`,
both deliberately private to `AccessManagementModule`; only the guard classes themselves are
exported). Order is significant: `AccessTokenGuard` always runs first, so a missing/invalid/expired
Bearer token always produces `401` before `AdminAuthorizationGuard` ever gets a chance to resolve
permissions and produce `403` - proven directly by `rbac-protection.http.spec.ts`'s guard-order
tests. `AccessTokenGuard`'s own JWT verification logic is unchanged from CLOUD-01C-A; it now also
checks `@Public()` and short-circuits to `true` before doing any Bearer/JWT work.

## 401 vs. 403

- No JWT, invalid JWT, expired JWT -> `401 INVALID_ACCESS_TOKEN` (unchanged from CLOUD-01C-A).
- Authenticated but missing a required permission (including the SUSPENDED case above) -> `403`,
  `ForbiddenError("FORBIDDEN", ...)` (from `@pos-cloud/shared-kernel`, added in CLOUD-01C-A,
  unused until now). The message is generic and never lists which permission was required, whether
  the cause was SUSPENDED, or anything about the internal role/permission taxonomy - deliberate
  information hygiene against a caller probing with a stolen JWT. Server-side logs still carry
  `correlationId` for legitimate debugging.

## Data model

New tables in the existing `access_management` schema (same bounded context as `admin_users`/
`admin_sessions` - RBAC is a property of admin identity, not a separate business capability):

- `permissions(code PK, description, created_at)` - static catalog.
- `admin_roles(code PK, name, created_at)` - static catalog.
- `role_permissions(role_code, permission_code)` - static mapping, composite PK, FK `role_code ->
admin_roles.code ON DELETE CASCADE`, FK `permission_code -> permissions.code ON DELETE RESTRICT`
  (never silently orphan a role mapping by deleting the permission it points to).
- `admin_user_roles(admin_user_id, role_code, assigned_at)` - the one dynamic table, composite PK,
  FK `admin_user_id -> admin_users.id ON DELETE CASCADE`, FK `role_code -> admin_roles.code ON
DELETE RESTRICT` (never delete a role that still has admins assigned to it).

No surrogate UUID on `permissions`/`admin_roles`: both are static catalog tables where the
human-readable code (`customers.read`, `PLATFORM_ADMIN`) is already the correct natural key. See
`libs/database/src/migrations/1786551814732-CreateAccessManagementRbac.ts` for the full DDL and
deterministic seed (10 permissions, 3 roles, 22 role_permissions mappings).

## Cross-context

`customer-management`/`licensing`/`installations` controllers import `PERMISSIONS`/
`RequirePermissions` (and `ApiBearerAuth`'s security-scheme name) from `@pos-cloud/access-management`

- a one-directional dependency, not a peer bounded-context relationship. `access-management` never
  imports any of those three (unchanged, still enforced by `.dependency-cruiser.cjs`'s
  `access-management-cannot-import-other-bounded-contexts` rule). Permission codes represent
  administrative capabilities (strings), never a reference, FK, or import of another context's
  aggregates.

## Bootstrap

`BootstrapFirstAdminUseCase` calls `AssignRoleToAdminUseCase` with `PLATFORM_ADMIN` right after
creating the AdminUser - not wrapped in a single cross-repository database transaction with that
save (which would need a new, bootstrap-only unit-of-work abstraction for a one-shot CLI path that
isn't a realistic concurrency target). Instead this relies on the assignment being idempotent
(`ON CONFLICT DO NOTHING`, never a caught unique-violation exception - see
`TypeOrmAdminRoleRepository`): if the process crashes between the two calls, the repair path is the
same idempotent statement the RBAC migration's own backfill step already runs.

`CreateAccessManagementRbac`'s `up()` separately grants `PLATFORM_ADMIN` to every `admin_users` row
that predates RBAC - the exact situation this repository is in today (CLOUD-01C-A's bootstrap already
ran, creating an AdminUser with zero roles before this migration existed). Both paths together mean
an AdminUser never ends up authenticated but permanently unable to do anything.

## Test strategy

- Domain: permission/role catalog shape and format (`permission.spec.ts`, `admin-role.spec.ts`), plus
  a migration/catalog divergence check (`admin-role.migration-seed.spec.ts`) that reads the
  migration's raw source text and asserts every seeded code/pair matches the TypeScript catalog
  exactly.
- Infrastructure: `typeorm-permission-resolver.adapter.spec.ts` (union across roles, empty set,
  unknown-code rejection), `typeorm-admin-role.repository.spec.ts` (proves `ON CONFLICT DO NOTHING`
  is actually used, not a caught exception).
- Guards: `admin-authorization.guard.spec.ts` (`@Public`/`@AuthenticatedOnly`/`@RequirePermissions`/
  default-deny/401-before-403 in isolation), `access-token.guard.spec.ts` (`@Public` bypass added).
- HTTP: `rbac-protection.http.spec.ts` (real signed JWTs through the real global guard chain -
  guard order, role shapes for all 3 roles, SUSPENDED), `auth.http.spec.ts` (login/refresh/logout
  `@Public`, `/me` `@AuthenticatedOnly`).
- Metadata matrix: `rbac-protection-matrix.spec.ts` uses `DiscoveryService`/`MetadataScanner` against
  the real compiled module graph (not a direct controller import - controllers are deliberately
  excluded from every package's public API) to assert the exact classification of all 17
  auth+business handlers, and that no handler exists outside that table.
- Existing CLOUD-01C-A regression suites (login, timing, lockout, refresh, rotation, replay, logout,
  `/me`, JWT) are unmodified except where RBAC's global guards required rewiring how a test
  authenticates (see `auth.http.spec.ts`'s real-JWT helper, replacing a bypassed
  `overrideGuard(AccessTokenGuard)` that no longer reliably intercepts a global `APP_GUARD`).

## Non-goals

Explicitly out of scope for CLOUD-01C-B, same list as the task brief: role/permission administration
endpoints, a second-admin creation/invite flow, MFA, change-password, password reset, rate limiting,
tenant-facing/customer-employee/POS-operator roles, Redis permission caching, ABAC, OAuth/OIDC,
external IdP, audit event persistence, frontend (`pos-cloud-web` does not start yet - the gate is
still CLOUD-01C-B/C/D).

## Audit integration points

CLOUD-01C-D added the audit store (`audit.audit_events`, `AuditRecorderPort`) - see
[audit.md](./audit.md). Role assignment (`AssignRoleToAdminUseCase`) was **not** wired to it:
its only current caller is the bootstrap script, which runs before any normal admin/actor context
exists - see [audit.md's action catalog](./audit.md#action-catalog-v1---10-codes) for why. Will be
audited once real AdminUser/Role administration ships with a genuine HTTP-driven admin actor.
