# ADR-014: Installation Enrollment / Credential Strategy

## Status

Accepted

## Context

CLOUD-01C-A/B built admin identity, authentication, and RBAC. Neither gave a POS installation any way
to authenticate as itself - `Installation.activate()` (`PENDING -> ACTIVE`) has existed in the domain
since CLOUD-01B with no caller, deliberately reserved for this task. CLOUD-01C-C must give an
Installation its own identity, completely independent of `AdminUser`, and decide exactly how a machine
proves it is a specific, previously-admin-created Installation.

The options considered:

**Enrollment mechanism** (how a POS machine first proves it is entitled to activate a specific
Installation).

- A (chosen). Random one-time enrollment code, admin-issued on demand, hashed at rest, consumed
  exactly once under a row lock.
- B. A pre-shared secret generated automatically at Installation-creation time.
- C. A short-lived signed JWT as the enrollment material.

A was chosen because it cleanly separates "material that proves entitlement to enroll" from "material
that authenticates ongoing requests" (option B conflates the two), and because a JWT (C) buys nothing
here - it still needs server-side tracking to be revocable/single-use, at which point it is just a
random opaque token with extra signing/verification machinery. A short, copy-pasteable random code is
also the easiest form factor for a field technician operating a WPF desktop client.

**Permanent credential** (what the Installation uses for every subsequent authenticated request).

- A (chosen). Opaque bearer credential (`<credentialId>.<secret>`), no JWT, no TTL - valid until
  explicitly revoked, verified by one indexed database join per request.
- B. Short-lived access JWT + a refresh mechanism, mirroring `AdminSession`.

A was chosen deliberately over the pattern this repository already uses for admins (B), because the two
situations are not actually analogous: SUSPEND/DECOMMISSION must take effect on an Installation's very
next request (see [admin-rbac.md](../architecture/admin-rbac.md)'s own SUSPENDED semantics for the
admin side, which tolerates a short JWT-trust window because sessions are rarely revoked mid-flight).
An Installation's operational status changes matter immediately and there is no volume pressure
(Control Plane admin/installation counts, not millions of requests/second) that would justify a
stateless fast-path. Adding a JWT layer on top of a lookup that already has to happen every request
would add secret-management and `typ`-collision complexity for zero benefit.

**Secret hashing.** SHA-256, not Argon2id - both the enrollment code and the credential secret are
already 256-bit random values, not human-chosen low-entropy passwords, so Argon2id's deliberate cost
would only add latency to every enrollment/authenticated request. Mirrors
`RefreshTokenGeneratorPort`'s own established precedent exactly (CLOUD-01C-A).

**Cross-context guard wiring** (how a machine-identity route coexists with CLOUD-01C-B's global,
default-deny admin guards without either bounded context importing the other's internals).

- A. Teach `AccessTokenGuard`/`AdminAuthorizationGuard` (owned by `access-management`) to import
  metadata keys defined inside `installations` - rejected, violates
  `access-management-cannot-import-other-bounded-contexts` with no exemption for that direction.
- B. Compose the new decorators on top of the existing `@Public()` decorator so the admin guards need
  zero changes - rejected: makes `@Public()` carry a second, hidden meaning ("or gated by a completely
  different guard elsewhere"), which weakens `@Public()` as a single, auditable statement of "no
  authentication of any kind" for a security-critical default-deny perimeter.
- C (chosen). Two bare, framework-free string constants (`IS_INSTALLATION_ENROLLMENT_KEY`,
  `IS_INSTALLATION_AUTHENTICATED_KEY`) live in **shared-kernel**, the one package both bounded contexts
  already unconditionally depend on. Both admin guards import and skip on them explicitly (a small,
  auditable addition to their own source); the decorators and the new `InstallationAuthGuard` are owned
  entirely by `installations`, importing nothing from `access-management`.

## Decision

- **Model**: two purposes, `INITIAL` (admin-issued, `PENDING` only, activates the Installation) and
  `RECOVERY` (admin-issued, `ACTIVE`/`SUSPENDED` only, manual rekey - never automatic/periodic rotation,
  never changes status) - see
  [installation-enrollment.md](../architecture/installation-enrollment.md#initial-vs-recovery-enrollment).
- **Data model**: `installation_enrollments`/`installation_credentials`, both in the `installations`
  schema (Installation identity, not admin identity), each with a partial unique index enforcing "at
  most one open enrollment" / "at most one active credential" per Installation.
- **Guards**: a 3rd global `APP_GUARD`, `InstallationAuthGuard`, registered after the two admin guards.
  No-ops on every route except `@InstallationAuthenticated()` ones; never touches
  `@InstallationEnrollment()` (that endpoint authenticates via its own request-body secret).
- **Concurrency**: enrollment-code replay is prevented by `SELECT ... FOR UPDATE` on the enrollment row
  inside a transaction that also locks the Installation row (Installation-first, in both the issuance
  and consumption unit-of-work implementations, deliberately - see
  [installation-enrollment.md#concurrency](../architecture/installation-enrollment.md#concurrency) for
  the lock-order-deadlock reasoning this specific ordering avoids).
- **Auth semantics**: pre-possession failures (bad code, bad credential) collapse to one generic error
  each (`ENROLLMENT_FAILED`/`INSTALLATION_CREDENTIAL_INVALID`, both 401); post-possession denials
  (`SUSPENDED`/`DECOMMISSIONED`) are specific 403s, since the caller has already proven possession of a
  valid credential by that point.

## Trade-offs

- No installation-side credential rotation in V1 - acceptable because no periodic caller exists yet
  (CLOUD-01C-D's heartbeat is the natural future trigger); revocation + a fresh recovery-enrollment is
  the only way back online after a compromise, which is deliberately a two-step, admin-mediated
  process, not self-service.
- The pre-existing `maxInstallations` count-then-insert race in `CreateInstallationUseCase` (CLOUD-01B)
  is **not** fixed here - activation is capacity-neutral (a `PENDING` installation already counts), so
  the race is orthogonal to this task's boundary. Recommended future fix documented as backlog: a
  PostgreSQL advisory lock keyed by `licenseId`, since `installations` cannot take `SELECT FOR UPDATE`
  on a `licensing`-schema row it does not own.
- `shared-kernel` now holds two bounded-context-adjacent string constants, a narrow, deliberate
  exception to its otherwise purely generic charter (`Clock`, `IdGenerator`, error taxonomy) -
  justified because the alternative (either bounded context importing the other's guard/decorator
  internals) is strictly worse for the two-sided dependency-cruiser rule this repository already
  enforces.

## Future hardening (explicitly out of scope for CLOUD-01C-C)

Heartbeat, health ingestion, audit persistence (integration points identified, not implemented),
periodic/automatic credential rotation, the `maxInstallations` race fix, Redis, installation JWT,
mTLS/PKI, rate limiting on the enroll endpoint. See
[installation-enrollment.md#non-goals](../architecture/installation-enrollment.md#non-goals-cloud-01c-c)
for the complete list.
