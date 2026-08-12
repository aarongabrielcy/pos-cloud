# Admin Identity & Authentication Foundation (CLOUD-01C-A)

Status: CLOUD-01C-A. Adds a new bounded context, `@pos-cloud/access-management`, on top of the
CLOUD-01B Control Plane Core (see [control-plane-core.md](./control-plane-core.md)). This task adds
admin identity and login/session infrastructure - it does **not** add RBAC, does **not** protect any
existing Control Plane route, and does **not** implement installation enrollment. See "Limits of
CLOUD-01C-A" at the end.

## Bounded context

`libs/control-plane/access-management/` follows the same internal layering as every other bounded
context (domain/application/infrastructure/presentation - see
[control-plane-core.md](./control-plane-core.md)). Two aggregates:

- **AdminUser** - `id`, `email` (normalized, unique), `displayName`, `passwordHash`, `status`
  (`ACTIVE`/`SUSPENDED`), `failedLoginAttempts`, `lockedUntil`, `lastLoginAt`. CLOUD-01C-B will
  extend this same package with roles/permissions - it is not a separate bounded context.
- **AdminSession** - `id`, `adminUserId`, `refreshTokenHash`, `expiresAt`, `revokedAt`,
  `replacedBySessionId`, `createdAt`, `lastUsedAt`. One row per issued refresh token; a login
  creates one, a refresh rotates it into a new one.

No cross-context port exists yet (unlike Installations' `CustomerReaderPort`/`LicenseReaderPort`) -
this context does not need to read anything from Customer Management/Licensing/Installations in
CLOUD-01C-A.

## AdminUser

### Email normalization

Trim + lowercase (`domain/email.ts`). The canonical lowercase form is what is persisted and
compared, so uniqueness (`admin_users.email UNIQUE`) is effectively case-insensitive without a
case-insensitive index/collation.

### Password policy

Minimum 12 characters, maximum 256 (`domain/password.ts`). Deliberately **no** forced composition
rules (uppercase/digit/symbol) - length is the strongest, best-evidenced lever for password
strength; composition rules mostly push users toward predictable substitutions ("Password1!") without
meaningfully raising entropy, per current password-guidance consensus (e.g. NIST SP 800-63B). The
raw password is never persisted, logged, or included in any exception message - see
`Password.reveal()`'s only caller (`PasswordHasherPort.hash`).

### Password hashing

**Argon2id**, via the `argon2` npm package (native, N-API bindings; ships prebuilt binaries for the
platforms this repository targets - Windows dev, Linux/Alpine Docker, Node 24). Parameters
(`infrastructure/security/argon2-password-hasher.adapter.ts`):

| Parameter     | Value      |
| ------------- | ---------- |
| `type`        | `argon2id` |
| `memoryCost`  | 19456 KiB  |
| `timeCost`    | 2          |
| `parallelism` | 1          |

This is the OWASP-recommended floor for Argon2id and is never reduced for tests - `PasswordHasherPort`
exists precisely so tests use a trivial fake (`test-support/fake-password-hasher.ts`) instead of
paying Argon2's real latency.

### Login failure / lockout

5 consecutive failed attempts locks the account for 15 minutes (`AdminUser.recordFailedLogin`,
`MAX_FAILED_LOGIN_ATTEMPTS`/`LOCK_DURATION_MS` in `domain/admin-user.ts`). A successful login resets
`failedLoginAttempts` to 0, clears `lockedUntil`, and stamps `lastLoginAt`.

Every rejection reason - unknown email, wrong password, locked account, suspended account - returns
the exact same public contract: `401 INVALID_CREDENTIALS`
(`InvalidAdminCredentialsError`, `domain/admin-user.errors.ts`). The failed-attempt counter is only
incremented for a genuinely wrong password on an account that could still attempt login; an unknown
email or an already-locked/suspended account never increments or extends a lockout window (see
`LoginAdminUseCase`'s own comment) - a request cannot make an unrelated account (or a nonexistent
one) appear "more locked" than it is.

No rate limiting exists yet - that is explicitly deferred to later security hardening, not this
task.

## Errors: 401 / 403

`libs/shared-kernel/src/errors.ts` gained two new base classes, extending the existing taxonomy the
same way `NotFoundError`/`ConflictError`/`ValidationError` already do:

- `UnauthorizedError` -> HTTP 401
- `ForbiddenError` -> HTTP 403

`AllExceptionsFilter` (`apps/api/src/common/all-exceptions.filter.ts`) maps both generically, the
same `{ statusCode, code, message, correlationId, details? }` contract as every other error - it
still never imports a bounded-context-specific error class. `ForbiddenError` has no caller yet in
CLOUD-01C-A (no authorization decisions exist without RBAC) - it exists now so CLOUD-01C-B doesn't
need another shared-kernel change to use it.

## Access token (JWT)

Short-lived, **HS256**, signed/verified via `@nestjs/jwt`'s `JwtService`
(`infrastructure/security/jwt-access-token.adapter.ts`). `JwtService` is provided directly (no
`JwtModule.register(...)`) - the secret/issuer/audience/TTL all come from `AuthConfig` per call,
since this is a library and must not own process configuration.

| Claim | Meaning                 |
| ----- | ----------------------- |
| `sub` | AdminUser id            |
| `sid` | Current AdminSession id |
| `typ` | Always `"admin_access"` |

Never contains a password, password hash, refresh token, or any other secret. `issuer`/`audience`
are checked on verify (not just signed on issue); the algorithm is pinned explicitly on both sides
(never accepted from the token header). Default TTL: 900 seconds (15 minutes).

## Refresh token (opaque)

**Not** a JWT. Format: `<sessionId>.<secret>`, where `secret` is 32 cryptographically random bytes
(256 bits), base64url-encoded (`infrastructure/security/crypto-refresh-token-generator.adapter.ts`).
PostgreSQL stores `sessionId` (the `admin_sessions.id` primary key) and `sha256(secret)`
(`admin_sessions.refresh_token_hash`) - **never** the raw secret. SHA-256 (not Argon2id) is
appropriate here because the secret is already high-entropy random data, not a low-entropy
human-chosen password; Argon2id's deliberate slowness would only add latency to every refresh call
for no security benefit.

### Cookie transport

Set only by `POST /auth/login` and `POST /auth/refresh`, cleared by `POST /auth/logout`. Never
present in a JSON response body.

| Attribute  | Value                                                                 |
| ---------- | --------------------------------------------------------------------- |
| `HttpOnly` | `true`                                                                |
| `SameSite` | `Lax`                                                                 |
| `Secure`   | `true` when `NODE_ENV=production`, `false` otherwise (local HTTP dev) |
| `Path`     | `/api/v1/auth` (matches `AuthController`'s own route prefix)          |
| Name       | `AUTH_REFRESH_COOKIE_NAME` (default `pos_cloud_admin_refresh`)        |

Prepared for a future `pos-cloud-web` frontend; no CORS configuration is added in this task.

### Refresh rotation

`POST /auth/refresh` is atomic: `AdminSessionUnitOfWork`
(`application/ports/admin-session-unit-of-work.port.ts`, implemented by
`infrastructure/persistence/typeorm-admin-session-unit-of-work.ts`) runs the whole operation inside
one PostgreSQL transaction with the target session row locked `SELECT ... FOR UPDATE`, so a
concurrent second refresh call presenting the same token blocks on the row lock instead of racing
past the read-then-write window. The port itself carries no TypeORM types - Application still only
depends on an interface.

Sequence (`RefreshAdminSessionUseCase`): parse `<sessionId>.<secret>` -> lock + load the session ->
hash the presented secret and compare -> reject (see below) on any mismatch/expiry/revocation ->
otherwise create a new session, revoke the old one (recording `replacedBySessionId`), issue a new
access token, and return the new refresh material for the controller to set as the new cookie.

### Replay / reuse detection

If a request presents a secret that **hashes correctly** against a session that is **already
revoked**, that is provably the genuine old refresh token being replayed (not a guess - the hash
matched a specific, already-rotated row) - every other currently-active session belonging to that
same AdminUser is revoked in response (`AdminSessionUnitOfWork.revokeAllActiveForUser`). A hash
mismatch against a still-active session is treated as an ordinary invalid token, not a replay
signal (a wrong secret proves nothing about intent).

The public response is always the same in every failure case: `401 INVALID_REFRESH_TOKEN`
(`InvalidRefreshTokenError`) - never "replay detected", never which specific check failed. Already-
issued access tokens are not proactively invalidated; their maximum remaining lifetime (15 minutes)
bounds the exposure window. Hardening that further (e.g. an access-token-revocation list) is
deferred.

## Logout

`POST /auth/logout` reads the refresh cookie (if any), revokes the corresponding session by id
(without verifying the secret - revoking by session id alone is sufficient; the secret's only job
is proving the _client_ holds a valid token, not gating logout of _your own_ session), and always
clears the cookie. Idempotent from the HTTP caller's perspective: a missing cookie, a malformed
token, or an already-revoked/unknown session all resolve as the same `204 No Content` - no detail
about _why_ is ever returned.

## GET /auth/me

The only Bearer-protected route in CLOUD-01C-A. `AccessTokenGuard`
(`presentation/http/guards/access-token.guard.ts`, exported from the package's public API precisely
so it is reusable) extracts and verifies the `Authorization: Bearer <token>` header via
`AccessTokenVerifierPort`, and attaches `{ adminUserId, sessionId }` to the request for
`@CurrentAdmin()` to read. Any failure (missing header, wrong scheme, invalid/expired/tampered
token) returns the same `401 INVALID_ACCESS_TOKEN`.

The response contains only public fields - `id`, `email`, `displayName`, `status`, `createdAt`,
`lastLoginAt` - never `passwordHash`, never any session data (`GetAdminProfileUseCase`,
`AdminMeResponseDto`).

## Bootstrap (first admin)

No `register`/`signup`/`create-admin` HTTP endpoint exists or ever will for this - admin users are
created only via the `admin:bootstrap` CLI tool
(`apps/api/src/tooling/admin-bootstrap.main.ts`, `pnpm admin:bootstrap` /
`pnpm admin:bootstrap:internal`, and the `pos-cloud-admin-bootstrap` Docker Compose service,
`profiles: ["tools"]`). It reads `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`/
`BOOTSTRAP_ADMIN_DISPLAY_NAME` from the invoking process's environment only (never written to any
`.env` file - Compose's `environment:` block lists only the variable _names_, which makes it pass
them through from the host shell). `BootstrapFirstAdminUseCase` refuses to run a second time: once
any `AdminUser` row exists, it fails with `409 ADMIN_BOOTSTRAP_ALREADY_COMPLETED` rather than
silently creating a second admin.

Requires the CLOUD-01C-A migration to already be applied (`admin_users` must exist). Not executed as
part of this task - the user runs `migration:run` then `admin:bootstrap` when ready.

## Config (AUTH_*)

`libs/config`'s `loadAuthConfig()` (separate from `loadConfig()`/`AppConfig`) - only `apps/api`'s
`AuthConfigModule` (`apps/api/src/auth/auth-config.module.ts`) calls it. `apps/worker`'s environment
never needs to declare any `AUTH_*` variable, and `AUTH_JWT_SECRET` is deliberately absent from
`infrastructure.env`/`worker.env` - the worker process has no authentication surface and must never
hold the secret that could forge an admin access token.

| Variable                         | Default                   |
| -------------------------------- | ------------------------- |
| `AUTH_JWT_SECRET`                | _(required, no default)_  |
| `AUTH_JWT_ISSUER`                | `pos-cloud`               |
| `AUTH_JWT_AUDIENCE`              | `pos-cloud-admin`         |
| `AUTH_ACCESS_TOKEN_TTL_SECONDS`  | `900`                     |
| `AUTH_REFRESH_TOKEN_TTL_SECONDS` | `604800`                  |
| `AUTH_REFRESH_COOKIE_NAME`       | `pos_cloud_admin_refresh` |

If `AUTH_JWT_SECRET` was missing from `../config/pos-cloud/api.env`, a cryptographically random
64-byte (hex-encoded, 128-character) secret was generated and appended directly to that file for
local development - never printed, never committed (see the final report's confirmation).

## Not implemented in CLOUD-01C-A

Roles/permissions/RBAC, an `APP_GUARD`-style global guard, protecting Customers/Licenses/
Installations, `@Public()` route exceptions, installation enrollment/`InstallationCredential`,
heartbeat/health ingestion, an audit event store, MFA/TOTP, rate limiting, password recovery, email
verification, OAuth, and the Payment Orchestrator. All of it is CLOUD-01C-B or later - see the task
brief's exclusion list; none of it exists here even as scaffolding.
