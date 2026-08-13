# Control Plane Audit (CLOUD-01C-D)

Not event sourcing, not a debug log. A minimal, professional, append-only record of the Control
Plane's real administrative and machine actions - see
[ADR-015](../adr/ADR-015-installation-health-and-audit-strategy.md) for why each decision below was
made; this document describes what was actually built.

## Cross-context write path

`AuditRecorderPort`/`AuditActorContext`/`AuditRequestContext`/`AuditEventInput`/`AUDIT_RECORDER_PORT`
all live in `@pos-cloud/shared-kernel` - the same "neutral ground both sides already depend on"
solution [ADR-014](../adr/ADR-014-installation-enrollment-strategy.md) used for
`IS_INSTALLATION_ENROLLMENT_KEY`. Every producer bounded context (`customer-management`, `licensing`,
`installations`, `access-management`) injects `AUDIT_RECORDER_PORT` directly - none of them import
`@pos-cloud/audit`. `AuditModule` (`@Global()`, imported once by `ControlPlaneModule`) binds the token
to its own `AuditRecorderAdapter`, self-sufficient (needs no cross-context reader port, unlike
`CrossContextPortsModule`'s `CustomerReaderAdapter`/`LicenseReaderAdapter`) - see
`.dependency-cruiser.cjs`'s `audit-cannot-import-other-bounded-contexts` /
`*-cannot-import-other-bounded-contexts` rules (extended to include `audit`) for the enforced
boundary.

## Actor resolution

Two shapes, both framework-free (no Express/Nest `Request` in Domain/Application):

- **`AuditActorContext`** (`{ actorType, actorId, correlationId }`) - the common case. The controller
  already knows the actor (`@CurrentAdmin()`) before calling the use case, so it builds this directly
  and passes it as the use case's second `execute()` argument, alongside the command. The correlation
  id is read off `request.id` (the same value `AllExceptionsFilter` already uses) via the same small
  inline helper each controller repeats (`buildAdminAuditActor` - mirrors this file's own existing
  duplication style rather than introducing a new shared abstraction).
- **`AuditRequestContext`** (`{ correlationId }` only) - `EnrollInstallationUseCase`'s special case.
  The controller only has an opaque enrollment code, not an installation id, until the use case itself
  resolves one inside its own transaction. The use case builds its own `AuditActorContext`
  (`actorType: INSTALLATION`, `actorId: <the resolved installation.id>`) only after the transaction
  has legitimately determined it - never from anything the caller supplies - and calls
  `AUDIT_RECORDER_PORT.record()` itself, after the transaction commits.

## Action catalog (V1 - 10 codes)

| Action                             | Use case                              | Actor        |
| ---------------------------------- | ------------------------------------- | ------------ |
| `customer.created`                 | `CreateCustomerUseCase`               | ADMIN        |
| `customer.status.changed`          | `ChangeCustomerStatusUseCase`         | ADMIN        |
| `license.created`                  | `CreateLicenseUseCase`                | ADMIN        |
| `license.status.changed`           | `ChangeLicenseStatusUseCase`          | ADMIN        |
| `license.entitlements.replaced`    | `ReplaceLicenseEntitlementsUseCase`   | ADMIN        |
| `installation.created`             | `CreateInstallationUseCase`           | ADMIN        |
| `installation.status.changed`      | `ChangeInstallationStatusUseCase`     | ADMIN        |
| `installation.enrollment.issued`   | `IssueInstallationEnrollmentUseCase`  | ADMIN        |
| `installation.enrollment.consumed` | `EnrollInstallationUseCase`           | INSTALLATION |
| `installation.credential.revoked`  | `RevokeInstallationCredentialUseCase` | ADMIN        |

Every code derived from an existing, already-implemented use case - none invented for a feature that
doesn't exist yet. Each bounded context owns its own action-code constants (`audit-actions.ts`, e.g.
`INSTALLATION_AUDIT_ACTIONS`) - not a shared enum every producer would need to coordinate on.

`admin.role.assigned` (`AssignRoleToAdminUseCase`) is deliberately **not** included: its only current
caller is the bootstrap script, which runs before any normal admin/actor context exists - inventing a
`SYSTEM`/bootstrap/fake-admin actor solely to audit that one call would misrepresent what actually
happened. Will be audited once real AdminUser/Role administration ships with a genuine HTTP-driven
admin actor.

Recorded only after the triggering mutation has actually succeeded (never for a rejected/rolled-back
attempt) - each use case calls `record()` as its last step, after `save()`/`replaceEntitlements()`/
the unit-of-work's `runExclusive()` has already resolved.

`RevokeInstallationCredentialUseCase` only records when a credential was actually revoked - its
idempotent no-op branch (no active credential) records nothing, since nothing happened.

## Metadata

Small, explicit, per-action whitelisted fields - never a raw request-body/entity dump:

```
installation.enrollment.issued:   { purpose: "INITIAL" | "RECOVERY" }
installation.enrollment.consumed: { purpose, resultingStatus }
*.status.changed:                 { from, to }
license.entitlements.replaced:    { entitlementCount }
```

Forbidden in metadata, permanently: `password`, `passwordHash`, `refreshToken`, `accessToken`,
`credential`, `credentialId` (when it implies secret material), `enrollmentCode`, `secret`,
`secretHash`, `authorization`, `cookie`. Enforced by discipline (explicit builder per action, never
generic serialization) rather than an automated filter that would first require collecting the
dangerous fields somewhere - see [Security](#security).

## Failure semantics

`AuditRecorderPort.record()` **never rejects** - the port's own documented contract. Use cases
`await` it for predictable ordering, not for error handling; no `try/catch` is needed at any call
site. `AuditRecorderAdapter` (the one real implementation) catches its own persistence failure
internally, logs a safe structured message (`action`, `resourceType`, `resourceId`, `correlationId`,
`actorType`, `actorId` - never `metadata`), and resolves regardless. A transient audit-write failure
must never fail the business action that triggered it.

No same-transaction coupling, no Outbox in V1 - see
[ADR-015's trade-offs](../adr/ADR-015-installation-health-and-audit-strategy.md#trade-offs) for the
reasoning and the documented risk (an event can be lost between the business commit and the audit
write). `AuditRecorderPort`'s implementation is a deliberate swap point: an Outbox-backed adapter can
replace `AuditRecorderAdapter` later with zero changes to any calling use case.

## Data model

```sql
audit.audit_events (
  id              uuid PRIMARY KEY,
  occurred_at     timestamptz NOT NULL,
  actor_type      varchar(20) NOT NULL,   -- CHECK IN ('ADMIN', 'INSTALLATION', 'SYSTEM')
  actor_id        varchar(100) NULL,
  action          varchar(100) NOT NULL,
  resource_type   varchar(50) NOT NULL,
  resource_id     varchar(100) NOT NULL,
  correlation_id  varchar(128) NOT NULL,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
)
```

New `audit` schema/bounded context - reserved by [ADR-007](../adr/ADR-007-bounded-context-data-ownership.md)
for exactly this. No FK to any other schema (a cross-cutting write sink cannot own a same-schema
relationship the way `installation_health` does - see
[installation-health.md#data-model](./installation-health.md#data-model) for that contrast).

Indexes: `occurred_at DESC` (recency-ordered reads), `(resource_type, resource_id)` (per-resource
history), `(actor_type, actor_id)` (per-actor history), `action` (filter by action code). No
speculative composite indexes beyond these four.

## Immutability

Append-only from the API's perspective: no `PATCH`/`DELETE` route exists anywhere in
`@pos-cloud/audit`. DB-role-level `REVOKE UPDATE, DELETE` on `audit_events` is a documented backlog
hardening item, not enforced by migration #6.

## Read API

```
GET /control-plane/audit-events
@RequirePermissions(PERMISSIONS.AUDIT.READ)
```

Paginated (`page`/`pageSize`, the same shared-kernel `PaginationParams` contract every other list
endpoint uses). Filters: `actorType`, `actorId`, `action`, `resourceType`, `resourceId`,
`correlationId`, `from`/`to` (ISO 8601, inclusive `occurred_at` bounds). No full-text search, no
arbitrary JSON metadata filtering - a deliberately small V1 surface. Ordered `occurred_at DESC, id
DESC` for stable pagination even when two events share a timestamp.

In scope for V1 (not deferred): without it, audit data would be write-only and unverifiable by
anyone except direct database access, defeating its own purpose - `pos-cloud-web` doesn't exist yet,
so this HTTP endpoint is the only way audit is operable at all right now.

## RBAC

One new permission, `audit.read`:

| Role                | `audit.read` |
| ------------------- | ------------ |
| `PLATFORM_VIEWER`   | no           |
| `PLATFORM_OPERATOR` | yes          |
| `PLATFORM_ADMIN`    | yes          |

Excluded from `PLATFORM_VIEWER`: audit reveals administrative action history (who suspended what,
who reissued a credential) - a step up in sensitivity from the bare resource `READ` permissions
`PLATFORM_VIEWER` already holds. `PLATFORM_OPERATOR` gets it because operators are the realistic
first responders investigating an incident.

## OpenAPI

`admin-bearer` only on `GET /control-plane/audit-events` - never `installation-bearer`.

## Security

| Risk                       | Class  | Mitigation                                                                                   |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Audit log injection        | Low    | explicit per-action metadata whitelist-builder, parameterized SQL                            |
| Secret leakage in metadata | Medium | discipline-enforced (no automated guarantee) - process risk for future action-code additions |
| Audit tampering (DB-level) | Medium | no API surface; DB grants not yet restricted - backlog                                       |
| Unbounded table growth     | Medium | append-only by design, no retention/archival in V1 - backlog                                 |

## Test plan

Application: for each of the 10 action codes - correct actor, action, resourceType, resourceId,
correlationId, safe metadata; `EnrollInstallationUseCase`'s special case (actorType `INSTALLATION`,
actorId the resolved installation id, never a caller-supplied value); no audit call on any rejection
path; no audit call for the idempotent credential-revoke no-op. Adapter: persistence succeeds -> row
inserted; persistence fails -> `record()` still resolves, no exception escapes, safe log emitted, no
metadata/secrets dumped. Read: pagination, stable ordering, every filter, no update/delete route.
Architecture: no producer context imports `@pos-cloud/audit`'s internals; `audit` imports no producer
context's internals; `access-management` remains the one RBAC exemption (same shape as every other
context).

## Non-goals

Event sourcing, a full SIEM, retention/archival engine, Outbox (deferred, see
[ADR-015](../adr/ADR-015-installation-health-and-audit-strategy.md#trade-offs)), admin login/security-
event auditing (login success/failure/lockout/refresh replay - natural future extension of the same
port), heartbeat-per-ping auditing, `ONLINE`/`OFFLINE` transition auditing, full-text search,
arbitrary metadata querying, frontend.
