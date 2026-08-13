# ADR-015: Installation Health and Audit Strategy

## Status

Accepted

## Context

CLOUD-01C-C gave an Installation its own identity (opaque bearer credential, `InstallationAuthGuard`).
It left two things explicitly deferred: a way for the server to know an Installation is still alive
("heartbeat, health ingestion... audit persistence" - ADR-014's own "Future hardening" list), and a
way to record who did what across the Control Plane. CLOUD-01C-D closes both.

The options considered:

**Lifecycle vs. operational health.** `InstallationStatus` (`PENDING`/`ACTIVE`/`SUSPENDED`/
`DECOMMISSIONED`) is an administrative decision. Whether a POS device is actually online right now is
a completely different, telemetry-derived fact - an `ACTIVE` installation can be `OFFLINE` for hours
without that being any kind of incident. Mixing the two (e.g. auto-suspending on missed heartbeats)
would make an operational blip silently become an administrative action with real consequences
(blocking a legitimate device from re-authenticating). Kept strictly separate: two enums, never merged
into one field anywhere in the domain, application, or HTTP response layer - see
[installation-health.md#lifecycle-vs-health](../architecture/installation-health.md#lifecycle-vs-health).

**Health computation** (how `ONLINE`/`STALE`/`OFFLINE`/`NEVER_SEEN` is derived).

- A (chosen). Persist only `lastSeenAt` (+ `firstSeenAt`, `appVersion`, `clientReportedAt`) as
  current-state; compute health at read time via one pure function
  (`computeInstallationHealth`), called from every read path.
- B. Persist a `status` column, updated by a periodic worker sweep.

A was chosen because B needs a worker job that does not otherwise exist yet in `apps/worker` (still
"no business jobs scheduled" as of CLOUD-01C-C), and because a computed value is trivially proven
correct (SQL and TypeScript can never diverge) whereas B introduces a genuine race (a heartbeat
arriving while the sweep is mid-update) with no compensating benefit for this task's actual scale.

**Heartbeat write path** (concurrent/out-of-order heartbeats for the same Installation).

A single atomic `INSERT ... ON CONFLICT (installation_id) DO UPDATE`, never a read-then-write.
`last_seen_at` uses `GREATEST()` so it can only advance; `app_version`/`client_reported_at` are tied to
the _same_ winning row (whichever heartbeat has the newest `receivedAt`), not updated independently -
a heartbeat that finishes processing later but was sent earlier must never overwrite fresher data with
stale data. `first_seen_at` is absent from the `UPDATE SET` clause entirely, so only the initial
`INSERT` ever sets it.

**Health storage** (which schema owns `installation_health`).

- A (chosen). A satellite table inside the existing `installations` schema.
- B. A new `health` schema (already reserved by [ADR-007](./ADR-007-bounded-context-data-ownership.md)
  for a possible future general telemetry platform).

A was chosen because this data is 1:1 with `Installation` and owned by nobody else - unlike audit
(below), there is no cross-cutting-write-sink argument for a separate bounded context here, and
introducing one (new package, new module, new guard wiring) for one small table would be
disproportionate. ADR-007's `health` schema remains available, un-consumed, for a genuinely general
future telemetry platform if one is ever built.

**Audit storage and cross-context write path** (every producer bounded context - customer-management,
licensing, installations, access-management - needs to write audit events without importing each
other or a shared package's internals).

- A. Each producer defines and implements its own local write port (mirrors the `CUSTOMER_READER_PORT`/
  `LICENSE_READER_PORT` pattern) - rejected: audit is one contract with one shape, duplicating it per
  producer buys nothing extra CUSTOMER_READER_PORT gets from being local (that pattern exists because
  _implementations_ differ per producer; here there is exactly one implementation).
- B (chosen). `AuditRecorderPort`/`AuditActorContext`/`AuditEventInput`/`AUDIT_RECORDER_PORT` all live
  in **shared-kernel** (the same "neutral ground both sides already depend on" solution ADR-014 used
  for `IS_INSTALLATION_ENROLLMENT_KEY`). A new `audit` bounded context (its own schema, reserved since
  ADR-007) provides the one real implementation, self-sufficient (needs no cross-context reader ports),
  and binds itself to the shared-kernel token from inside its own `@Global()` `AuditModule` - no
  apps/api-level composition wiring needed beyond importing that one module.

## Decision

- **Health model**: `NEVER_SEEN | ONLINE | STALE | OFFLINE`, computed, never persisted.
  `SUSPENDED`/`DECOMMISSIONED` always report `OFFLINE` regardless of `lastSeenAt` recency (both are
  guard-rejected before a heartbeat can land, so their `lastSeenAt` is frozen - without this override
  a just-suspended Installation would misleadingly still show `ONLINE`). See
  [installation-health.md#health-model](../architecture/installation-health.md#health-model).
- **Thresholds**: `INSTALLATION_HEARTBEAT_INTERVAL_SECONDS` (60), `_STALE_AFTER_SECONDS` (120),
  `_OFFLINE_AFTER_SECONDS` (300) - config-driven, not hardcoded, validated `stale > interval`,
  `offline > stale`.
- **Heartbeat endpoint**: `POST /api/v1/installation-health/heartbeat`, `@InstallationAuthenticated()`,
  204 (no server-to-POS payload exists yet worth returning). Identity exclusively from
  `@CurrentInstallation()` - a body-supplied installation id is never accepted.
- **Worker**: does not participate. Health being computed (not swept) eliminates the
  worker-vs-heartbeat race class entirely, by construction.
- **Audit event model**: `id, occurredAt, actorType (ADMIN|INSTALLATION|SYSTEM), actorId, action,
resourceType, resourceId, correlationId, metadata` - `audit.audit_events`, append-only (no
  update/delete route anywhere in `@pos-cloud/audit`).
- **Audit action catalog (V1, 10 codes)**: `customer.created`, `customer.status.changed`,
  `license.created`, `license.status.changed`, `license.entitlements.replaced`,
  `installation.created`, `installation.status.changed`, `installation.enrollment.issued`,
  `installation.enrollment.consumed`, `installation.credential.revoked` - each derived from an
  existing, real use case; none invented for a feature that doesn't exist yet.
  `admin.role.assigned` deliberately excluded: `AssignRoleToAdminUseCase` has no real admin-facing HTTP
  flow yet (its only caller is the bootstrap script, which runs before any normal admin/actor exists) -
  will be audited when real AdminUser/Role administration ships.
- **Actor resolution**: two shapes. Admin-authenticated use cases take a fully-resolved
  `AuditActorContext` the controller builds from `@CurrentAdmin()` + the request's correlation id.
  `EnrollInstallationUseCase` is the one exception - the controller only has an opaque enrollment code,
  not an installation id, until the use case itself resolves one inside its own transaction; it takes
  the minimal `AuditRequestContext` (`correlationId` only) and builds `{actorType: INSTALLATION,
actorId: <resolved installation.id>}` internally, once the transaction has legitimately determined
  it - never from anything a caller supplies.
- **Failure semantics**: best-effort. `AuditRecorderPort.record()` never rejects - a real persistence
  failure is caught inside `AuditRecorderAdapter`, logged safely (action/resourceType/resourceId/
  correlationId/actorType/actorId only, never `metadata`), and swallowed. A transient audit-write
  failure must never fail the business action that triggered it.
- **RBAC**: one new permission, `audit.read` (`PLATFORM_OPERATOR`/`PLATFORM_ADMIN`, not
  `PLATFORM_VIEWER` - audit reveals administrative action history, a step up in sensitivity from the
  bare resource `READ` permissions `PLATFORM_VIEWER` already holds).

## Trade-offs

- No heartbeat history in V1 - only current-state (`lastSeenAt`/`firstSeenAt`/`appVersion`). Accepted
  to avoid unbounded write-heavy growth for data with no established consumer need yet; `firstSeenAt`
  is kept as the one lightweight, genuinely useful historical fact.
- No audit event for an individual heartbeat, and no audit event for `ONLINE`/`OFFLINE` transitions -
  auditing every heartbeat would make audit into telemetry (explicitly against its own charter);
  auditing only detectable "back online" transitions (not "went offline", which needs a worker sweep
  this design deliberately avoids) would be an asymmetric, misleading trail. Revisit if a worker-based
  sweep is ever justified for an unrelated reason.
- Audit is best-effort, not transactional with the business action it describes, and not Outbox-backed.
  An event can be lost if the process crashes between the business commit and the audit write, or if
  the insert itself fails. Accepted for V1: audit here is an operational/administrative log, not a
  financial ledger or a compliance-grade guarantee. `AuditRecorderPort`'s implementation is a deliberate
  swap point - an Outbox-backed adapter can replace `AuditRecorderAdapter` later with zero changes to
  any calling use case, if stronger delivery guarantees are ever needed.
- `audit.read`'s DB-level immutability is enforced only by "no endpoint exists for it" - the
  application's PostgreSQL role is not `REVOKE`d from `UPDATE`/`DELETE` on `audit_events` in V1.
  Documented backlog hardening item, not a blocker.
- The pre-existing `maxInstallations` count-then-insert race in `CreateInstallationUseCase`
  (CLOUD-01B, still present, re-confirmed by direct inspection this task) is **not** fixed here -
  orthogonal to this task's boundary, tracked as backlog.

## Future hardening (explicitly out of scope for CLOUD-01C-D)

Heartbeat rate limiting, audit retention/archival policy, DB-role-level `REVOKE UPDATE, DELETE` on
`audit_events`, Outbox-backed audit delivery, admin login/security-event auditing (login success/
failure/lockout/refresh replay - a natural, low-friction extension of the same `AuditRecorderPort`),
worker-based offline-transition detection, the `maxInstallations` race fix. See
[installation-health.md#non-goals](../architecture/installation-health.md#non-goals) and
[audit.md#non-goals](../architecture/audit.md#non-goals) for the complete lists.
