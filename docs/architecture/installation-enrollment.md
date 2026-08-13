# Installation Enrollment / Credentials / Activation (CLOUD-01C-C)

## Principles

Installation identity is completely separate from AdminUser identity. A POS installation never
authenticates via admin login, an admin access JWT, or the admin refresh cookie - and an admin JWT is
never accepted by any installation-authenticated endpoint. See [Identity separation](#identity-separation).

An `Installation` is created `PENDING` by an admin (`POST /control-plane/installations`, CLOUD-01B).
Real activation (`PENDING -> ACTIVE`) only ever happens through a successful machine enrollment - no
admin endpoint can reach `ACTIVE` from `PENDING` (`Installation.changeStatus`'s admin transition table
deliberately excludes it; `Installation.activate()` is a separate domain method, called only by
`EnrollInstallationUseCase`).

## Config

`INSTALLATION_ENROLLMENT_TTL_SECONDS` (default 900) is loaded by `loadInstallationAuthConfig`
(`@pos-cloud/config`), independently of `loadAuthConfig`'s `AUTH_*` group - installation identity's
configuration lifecycle must never be coupled to AdminUser identity's (see
[Principles](#principles)). Wired via `InstallationAuthConfigModule` (`@Global()`, mirrors
`AuthConfigModule`), imported by `ControlPlaneModule`.

## Initial vs. recovery enrollment

Two distinct enrollment purposes, both stored on `installation_enrollments.purpose`:

| Purpose    | Who issues it                                          | Permission                         | Eligible source status  | Effect on success                              |
| ---------- | ------------------------------------------------------ | ---------------------------------- | ----------------------- | ---------------------------------------------- |
| `INITIAL`  | Admin (`POST .../:id/enrollment`)                      | `installations.enrollment.manage`  | `PENDING` only          | `PENDING -> ACTIVE`, issues credential         |
| `RECOVERY` | Admin (`POST .../:id/credentials/recovery-enrollment`) | `installations.credentials.manage` | `ACTIVE` or `SUSPENDED` | status unchanged, issues (replaces) credential |

`RECOVERY` is manual credential recovery/rekey (lost, compromised, or revoked credential) - not
periodic/automatic rotation, which remains out of scope (no consumer exists until CLOUD-01C-D's
heartbeat). A `SUSPENDED` installation that recovery-enrolls gets a fresh credential but stays
`SUSPENDED` - it still cannot use any installation-authenticated endpoint until an admin reactivates it
(`PATCH .../:id/status`).

The two purposes are deliberately gated by **different** permissions, not folded into one, so
`PLATFORM_OPERATOR` (which gets `installations.enrollment.manage`, a natural extension of its existing
`installations.create` onboarding capability) cannot indirectly perform what is really a credential
replacement/security-incident-response action - that stays `PLATFORM_ADMIN`-only
(`installations.credentials.manage`). See [Admin permissions](#admin-permissions).

`domain/installation-enrollment-eligibility.ts`'s `isInstallationEligibleForEnrollment` is the single
source of truth for the purpose -> eligible-status table, used both by admin-side issuance (which
rejects a bad request with a specific 409) and by `EnrollInstallationUseCase`'s own fresh re-check at
consumption time (status may have changed between issuance and consumption; that path collapses to the
generic 401 `ENROLLMENT_FAILED` - see [Error contracts](#error-contracts)).

## Enrollment flow

```
Admin: POST /control-plane/installations/:id/enrollment (or .../credentials/recovery-enrollment)
  -> IssueInstallationEnrollmentUseCase, inside InstallationEnrollmentIssuanceUnitOfWork:
     lock Installation FOR UPDATE -> validate eligibility for purpose -> revoke any prior open
     enrollment for this Installation -> insert new installation_enrollments row -> COMMIT
  -> 201, { installationId, enrollmentCode: "<enrollmentId>.<secret>", expiresAt } - shown ONCE

POS Desktop/App: POST /installation-auth/enroll { enrollmentCode }
  -> EnrollInstallationUseCase:
     1. parse "<id>.<secret>"; unlocked read of the enrollment row (learn its installationId)
     2. InstallationEnrollmentConsumptionUnitOfWork.runExclusive(installationId, ...):
        lock Installation FOR UPDATE -> lock the enrollment row FOR UPDATE -> verify secret
        (crypto.timingSafeEqual) -> check isConsumable(now) -> check eligibility for purpose ->
        fresh Customer ACTIVE check -> fresh License.isUsable(now) check -> mark enrollment
        consumed -> if INITIAL and PENDING: Installation.activate() -> revoke any existing active
        credential -> issue new installation_credentials row -> COMMIT
  -> 201, { installationId, credential: "<credentialId>.<secret>" } - shown ONCE
  -> any failure at any step -> 401 ENROLLMENT_FAILED, generic
```

See [Concurrency](#concurrency) for why the two unit-of-work implementations both lock the
`Installation` row before touching any enrollment row, even though the flow narrative above reads
enrollment-first.

## Credential flow

The permanent credential is an **opaque bearer credential**, not a JWT - `<credentialId>.<secret>`,
presented as `Authorization: Bearer <credentialId>.<secret>`. No JWT anywhere in the installation
plane: every installation-authenticated request already requires one PostgreSQL round trip regardless
(to check live `Installation.status` for immediate suspend/decommission effect - see
[Auth semantics](#auth-semantics)), so a stateless JWT fast-path would add signing/TTL/`typ`-collision
complexity for no real benefit. No TTL either - the credential is valid until explicitly revoked.

- **Issued**: on every successful enrollment (INITIAL or RECOVERY). Any existing active credential for
  that Installation is revoked first, in the same transaction.
- **Used**: `InstallationAuthGuard` verifies it via `InstallationCredentialVerifierPort` - one indexed
  join query (`installation_credentials` + `installations`), the structural twin of
  `TypeOrmPermissionResolverAdapter`. No Redis, no N+1.
- **Revoked**: admin-triggered, `POST /control-plane/installations/:id/credentials/revoke`
  (`installations.credentials.manage`). Idempotent (204 even with no active credential), never changes
  `Installation.status`, never deletes the row. Recovery back online requires a separate
  recovery-enrollment - revocation and re-credentialing are deliberately independent actions.
- **Rotated**: not built in V1 - no periodic caller exists until CLOUD-01C-D's heartbeat. Backlog.

At most one active credential may exist per Installation - enforced both by the use case (revoke old,
then insert new, in one transaction) and structurally by a partial unique index
(`ux_installation_credentials_installation_id_active`).

## Admin permissions

Two new permissions (migration #5, not migration #3 - see [Migration plan](#migration-plan)):

| Code                               | Role matrix                           |
| ---------------------------------- | ------------------------------------- |
| `installations.enrollment.manage`  | `PLATFORM_OPERATOR`, `PLATFORM_ADMIN` |
| `installations.credentials.manage` | `PLATFORM_ADMIN` only                 |

## Endpoints

| METHOD | PATH                                                               | IDENTITY                                 | AUTH                               | PURPOSE                                                                                              |
| ------ | ------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| POST   | `/control-plane/installations/:id/enrollment`                      | Admin                                    | `installations.enrollment.manage`  | Issue/regenerate INITIAL enrollment code                                                             |
| POST   | `/control-plane/installations/:id/credentials/recovery-enrollment` | Admin                                    | `installations.credentials.manage` | Issue RECOVERY enrollment code                                                                       |
| POST   | `/control-plane/installations/:id/credentials/revoke`              | Admin                                    | `installations.credentials.manage` | Revoke active credential (204, idempotent)                                                           |
| POST   | `/installation-auth/enroll`                                        | None (enrollment code is the credential) | `@InstallationEnrollment()`        | Consume code, activate/no-op, issue credential                                                       |
| GET    | `/installation-auth/session`                                       | Installation                             | `@InstallationAuthenticated()`     | Minimal identity check - proves the pipeline; CLOUD-01C-D's heartbeat will reuse this infrastructure |

## Guards

Three global `APP_GUARD`s, registered in this order in `ControlPlaneModule`: `AccessTokenGuard` ->
`AdminAuthorizationGuard` -> `InstallationAuthGuard`.

The two new route-classification keys (`IS_INSTALLATION_ENROLLMENT_KEY`,
`IS_INSTALLATION_AUTHENTICATED_KEY`) live in **shared-kernel** as bare, framework-free string
constants - not in `access-management` (installations must stay ignorant of admin identity, and vice
versa per [Principles](#principles)) and not in `installations` importing back into
`access-management`'s guards (would violate
`access-management-cannot-import-other-bounded-contexts` in `.dependency-cruiser.cjs`, no exemption
exists for that direction). Both bounded contexts already unconditionally depend on shared-kernel, so
this is the one place both sides can agree on the keys without creating a new cross-context edge.

- `AccessTokenGuard`/`AdminAuthorizationGuard` (owned by `access-management`) both import these two
  keys and skip unconditionally on either - a small, explicit, auditable addition to already-shipped
  CLOUD-01C-B guard code (not forbidden; only migration #3 is untouchable, not guard source).
- The `@InstallationEnrollment()`/`@InstallationAuthenticated()` decorators and `InstallationAuthGuard`
  itself are owned entirely by `installations`, importing nothing from `access-management`.
- `InstallationAuthGuard` no-ops (`return true`) on every route except `@InstallationAuthenticated()`
  ones - it never processes `@InstallationEnrollment()` (that endpoint authenticates via its own
  body-level enrollment code, not a Bearer credential).

Default-deny is preserved: an unclassified route is still rejected (401 by `AccessTokenGuard` with no
admin token, or 403 by `AdminAuthorizationGuard`'s existing catch-all with one) - the set of recognized
classifications simply grew from 3 to 5. `@InstallationEnrollment()`/`@InstallationAuthenticated()` are
deliberately distinct from `@Public()` (even though both admin guards also skip on them) - see
`rbac-protection-matrix.spec.ts`'s closure test, which asserts every `@Public()` handler is one of the
genuinely-public AuthController routes, never one of these two.

## Auth semantics

Every installation-authenticated request hits PostgreSQL once (no Redis, no stateless fast-path) so
SUSPEND/DECOMMISSION take effect on the very next request:

| Condition                                                                   | HTTP | Code                                                                                                 |
| --------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| Missing/malformed Authorization header                                      | 401  | `INSTALLATION_CREDENTIAL_INVALID`                                                                    |
| Unknown credential id / wrong secret / revoked                              | 401  | `INSTALLATION_CREDENTIAL_INVALID` (generic - anti-enumeration, caller has not yet proven possession) |
| Valid credential, Installation `SUSPENDED`                                  | 403  | `INSTALLATION_SUSPENDED` (specific - caller already proved possession)                               |
| Valid credential, Installation `DECOMMISSIONED`                             | 403  | `INSTALLATION_DECOMMISSIONED`                                                                        |
| Valid credential, Installation `PENDING` (should never happen by invariant) | 401  | `INSTALLATION_CREDENTIAL_INVALID` (fail closed)                                                      |

## Error contracts

`EnrollmentFailedError` (401 `ENROLLMENT_FAILED`) is the single, generic, machine-facing error for
every enrollment failure cause - malformed/unknown code, wrong secret, expired, consumed, revoked,
wrong Installation status for the code's purpose, ineligible Customer, unusable License. Mirrors
`InvalidAdminCredentialsError`/`InvalidRefreshTokenError`'s existing precedent exactly: pre-possession
failures stay maximally generic. Admin-side issuance errors (`InstallationNotEligibleForEnrollmentError`, 409) are specific, since the caller there is already authenticated/authorized.

`crypto.timingSafeEqual` (never `===`) is mandated for every secret/hash comparison
(`InstallationSecretGeneratorPort.secretMatchesHash`).

## Concurrency

**Enrollment-code replay**: `InstallationEnrollmentConsumptionUnitOfWork`, one transaction,
`SELECT ... FOR UPDATE` on the enrollment row - a second concurrent consume attempt with the same code
blocks, then sees `consumedAt` already set.

**Concurrent issuance** (CORRECTION #2): `InstallationEnrollmentIssuanceUnitOfWork` locks the
Installation row first, so two admins issuing enrollment for the same Installation at the same time
serialize. A partial unique index (`ux_installation_enrollments_installation_id_open`, predicate
`consumed_at IS NULL AND revoked_at IS NULL`) is the structural backstop.

**Lock order**: both unit-of-work implementations lock the `Installation` row **before** any
enrollment row, even though the plain-language flow in [Enrollment flow](#enrollment-flow) lists
"verify secret" (which requires locking the enrollment row) before "lock Installation". Reversing that
literal order here was a deliberate fix: locking Installation-then-enrollment in one unit-of-work and
enrollment-then-Installation in the other is a textbook lock-order deadlock (a concurrent issue and a
concurrent consume on the same Installation could each block on the other, which Postgres resolves by
aborting one side with `deadlock_detected` - not corruption, but an avoidable 500). Consumption
performs one earlier, unlocked, informational read of the enrollment row purely to learn which
Installation to lock first, then re-verifies everything under the lock.

**`maxInstallations`**: NOT touched by this task. A `PENDING` installation already counts as
non-DECOMMISSIONED from `CreateInstallationUseCase` (CLOUD-01B) - activating it via enrollment does not
increase the count for its license. The pre-existing `CreateInstallationUseCase` count-then-insert race
remains open, MEDIUM-severity backlog (recommended fix: a PostgreSQL advisory lock keyed by licenseId,
since `installations` cannot take `SELECT FOR UPDATE` on a `licensing`-schema row it doesn't own).

## Data model

Both tables in schema **`installations`** (Installation identity, not admin identity - same schema as
`installations.installations`, matching ADR-010's same-schema-only-FK rule):

- `installation_enrollments(id, installation_id, purpose, code_hash, created_at, expires_at,
consumed_at, revoked_at)` - `ON DELETE CASCADE` to `installations.installations`, `CHECK` on
  `purpose`/`code_hash` format/`expires_at > created_at`, plus the partial unique "one open enrollment"
  index above.
- `installation_credentials(id, installation_id, secret_hash, created_at, revoked_at)` - same FK
  behavior, `CHECK` on `secret_hash` format, plus the partial unique "one active credential" index.

`InstallationEnrollment`/`InstallationCredential` are separate, thin domain entities (not nested inside
the `Installation` aggregate) - mirrors `AdminSession`'s existing shape.

## Migration plan

- **Migration #4** (`CreateInstallationEnrollmentCredentials`): pure `installations`-schema DDL - the
  two tables above.
- **Migration #5** (`ExtendAccessManagementRbacForInstallationEnrollment`): pure `access_management`
  DML - the 2 new permissions + 3 new `role_permissions` rows. Migration #3
  (`CreateAccessManagementRbac`) is immutable and was **not** touched.

Both created but not executed by this task - the user runs `pnpm migration:run`.

## Test plan

Domain (entity invariants, eligibility table), application (all 3 use cases against in-memory fakes,
every failure branch), infrastructure (secret generator, credential verifier adapter, both
unit-of-work adapters against fake `EntityManager`/`DataSource` - this repository has no real-Postgres
test harness anywhere, see `typeorm-admin-session-unit-of-work.spec.ts`'s own comment; true row-lock
serialization under real concurrency is therefore not exercised by an automated test here, consistent
with that existing precedent, not a new gap introduced by this task), guard (`InstallationAuthGuard`
plus the two admin guards' new skip cases), HTTP (`installation-auth.http.spec.ts` - full pipeline +
identity separation; `installations.http.spec.ts` - the 3 new admin endpoints;
`rbac-protection.http.spec.ts` - `PLATFORM_OPERATOR` vs `PLATFORM_ADMIN` role separation;
`rbac-protection-matrix.spec.ts` - all 5 new handlers plus a closure test that no
`@InstallationEnrollment()`/`@InstallationAuthenticated()` route is ever miscounted as `@Public()`).

## Identity separation

Verified directly by HTTP test: an installation credential presented to an admin business route or
`/auth/me` is rejected 401 `INVALID_ACCESS_TOKEN` (`AccessTokenGuard` never parses it as a JWT); a real,
validly-signed admin access JWT presented to `/installation-auth/session` is rejected 401
`INSTALLATION_CREDENTIAL_INVALID` (`InstallationAuthGuard` never finds a matching credential row for a
JWT's structure).

## Non-goals (CLOUD-01C-C)

Heartbeat, health ingestion, audit persistence (audit integration points identified below, not
implemented), periodic/automatic credential rotation, the pre-existing `maxInstallations` race fix,
Redis, installation JWT, mTLS/PKI, frontend, mobile, desktop sync, rate limiting on
`/installation-auth/enroll` (entropy alone already makes brute force infeasible within the enrollment
TTL; a backlog defense-in-depth item, not a gap).

## Audit integration points

CLOUD-01C-D added the audit store and wired it here - see [audit.md](./audit.md#action-catalog-v1---10-codes):
`installation.enrollment.issued`, `installation.enrollment.consumed` (actor `INSTALLATION`, not
`ADMIN` - the machine resolved its own identity via the enrollment code), `installation.credential.revoked`,
`installation.created`, `installation.status.changed`. Credential rotation was not added - periodic/
automatic rotation remains this document's own non-goal (see above); recovery-enrollment is covered
by `installation.enrollment.issued`'s `purpose: "RECOVERY"` metadata.
