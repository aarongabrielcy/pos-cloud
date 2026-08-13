# ADR-016: OpenAPI Response Contract Completeness and Effective Permissions Exposure

## Status

Accepted

## Context

`pos-cloud-web` (the frontend ADR-011 anticipated as `pos-admin-web`) began WEB-01A and immediately
blocked: `GET /openapi.json` never described any response body. `openapi-typescript` generated
`content?: never` for `POST /api/v1/auth/login`, `/refresh`, `/logout`, and `GET /api/v1/auth/me` -
and inspection confirmed the gap was API-wide, not Auth-specific: every request DTO
(`CreateCustomerRequestDto`, etc.) appeared in `components.schemas` (Nest infers those from
`@Body()` parameter types automatically), but no response DTO did, for any of the 25 current
operations.

ADR-011 got the contract mechanism right (OpenAPI, generated from live decorators, no hand-maintained
file) but implicitly assumed `@ApiProperty` on a response DTO's fields was sufficient to wire it into
a route's documented response. It is not: `@nestjs/swagger` only knows a handler's response shape if
something explicitly tells it - either a class-level Swagger CLI plugin (auto-infers from TS return
types) or a per-handler `@ApiOkResponse`/`@ApiCreatedResponse`/etc. decorator referencing the DTO.
This repo has neither `nest-cli.json` nor any such decorator anywhere, on any of the 8 controllers.

Separately, `pos-cloud-web`'s design phase also confirmed `GET /auth/me` has no way for the frontend
to know what the current admin can actually do - no `permissions`/`roles` field, and (correctly) no
appetite to decode a JWT that only carries `{sub, sid, typ}` or to hardcode role names client-side.

## Decision

**OpenAPI response completeness** - explicit per-handler decorators, not the Swagger CLI plugin:

- Chosen: `@ApiOkResponse`/`@ApiCreatedResponse`/`@ApiNoContentResponse({ type: XResponseDto })` on
  every handler, referencing the same response DTO classes the handler already returns (all 25
  operations already had well-formed, `@ApiProperty`-decorated response DTO classes - the only gap
  was wiring, not missing DTOs; zero new response DTOs were needed).
- Rejected: enabling `@nestjs/swagger`'s CLI plugin (`nest-cli.json` + `compilerOptions.plugins`),
  which auto-infers response types from TS return-type inference. Larger blast radius (a new,
  implicit build-tooling dependency, repo-wide, for every future handler including ones nobody
  reviews for Swagger-correctness) versus explicit decorators' visible, reviewable, one-line-per-
  handler contract living right next to `@ApiOperation`. This repo already prefers explicit
  decorators over framework magic everywhere else (see e.g. ADR-002's hexagonal boundaries) -
  consistent with that.
- **Error contract**: one `@ApiErrorResponse()` class-level decorator (new, in `access-management`,
  re-exported for every controller to apply once) registers `AllExceptionsFilter`'s one real error
  shape (`{statusCode, code, message, correlationId, details?}`) under OpenAPI's `default` response
  key - not 40 near-duplicate per-handler decorators for domain errors that don't vary in shape, only
  in `statusCode`/`code`/`message` value (which a generic schema doesn't need to encode).
- **Pagination**: no new generic/shared decorator - every list endpoint already had its own concrete
  `XListResponseDto` (`CustomerListResponseDto`, `LicenseListResponseDto`,
  `InstallationListResponseDto`, `AuditEventListResponseDto`), each with a real `{ type: [XDto] }`
  items array. Wiring `@ApiOkResponse({ type: XListResponseDto })` was sufficient - the "concrete DTO
  per resource" option, not a generic helper, since one already existed per resource.
- **Regression protection**: `openapi.spec.ts` gained a document-level completeness test asserting
  every current operation's 2xx responses resolve to a real schema (except 204s, which must have
  none) - this is what would have caught the original gap, and will catch a future handler that ships
  without its own `@ApiOkResponse`.

**Effective permissions on `/auth/me`** - extend the existing endpoint, not a new one:

- `GetAdminProfileUseCase` now also injects `PERMISSION_RESOLVER` (`PermissionResolverPort` - the
  exact same authority `AdminAuthorizationGuard` already queries per-request) and returns
  `permissions: readonly PermissionCode[]`, sorted lexicographically for a deterministic response (no
  reliance on PostgreSQL's accidental row order - matters for tests, OpenAPI examples, and any future
  frontend cache/diffing).
- Rejected: a separate `GET /auth/me/permissions` endpoint - the frontend always needs both the
  profile and the permission list together (there's no use case for one without the other yet), and
  a second round trip buys nothing a combined response doesn't already give for free.
- Rejected: encoding permissions into the JWT - the access token would need to be re-issued on every
  permission change (no session invalidation mechanism ties JWTs to role changes), and this repo's
  own `docs/architecture/admin-rbac.md#jwt-vs-db-lookup` already rejected JWT-embedded authorization
  data for the exact same reason `PermissionResolverPort` exists: fresh-per-request DB resolution,
  no caching, no staleness window.
- A SUSPENDED admin's `/auth/me` call (an existing, already-tested, deliberately-unchanged behavior -
  a valid JWT is never re-checked against live `AdminUserStatus` outside login) now correctly
  resolves `permissions: []` via the same resolver `AdminAuthorizationGuard` would use to reject every
  real permission-gated request for that same admin - consistent, not a new special case.

## Consequences

- `pos-cloud-web` can resume WEB-01A: `openapi-typescript` now generates real response types for
  `login`/`refresh`/`me`, and for every current Customers/Licenses/Installations/Audit/machine
  endpoint WEB-02/WEB-03 will eventually need - this was deliberately not limited to just the 4 Auth
  routes, to avoid re-blocking those future slices.
- `permissions` is capability data for UX only (hide/disable, don't security-gate) - the backend
  remains the sole authority; every permission-gated request is still checked server-side by
  `AdminAuthorizationGuard` regardless of what a stale/cached frontend `permissions` array says. This
  must never become a client-side security boundary.
- CORS remains explicitly out of scope/closed: `pos-cloud-web` adopted a same-origin topology (Vite
  dev proxy in development, a reverse proxy in production) specifically to avoid needing
  `app.enableCors()` at all - see `docs/architecture/admin-rbac.md` and the frontend's own README.
  Reopen only if frontend and API are ever deployed genuinely cross-origin.
- `@ApiErrorResponse()`'s `default` response key documents the _shape_ every error takes, not which
  specific errors a given handler can throw - a consumer still needs to read each handler's
  `@ApiOperation` description/this repo's docs to know, e.g., that `POST /licenses` can 409 on a
  duplicate `licenseNumber`. Accepted: enumerating every domain error per handler was explicitly
  rejected as unmaintainable noise (see Decision).
