# Installation Heartbeat / Operational Health (CLOUD-01C-D)

## Principles

Lifecycle (`InstallationStatus`: `PENDING`/`ACTIVE`/`SUSPENDED`/`DECOMMISSIONED`) and operational
health (`InstallationHealthStatus`: `NEVER_SEEN`/`ONLINE`/`STALE`/`OFFLINE`) are two completely
separate concepts, never merged into one field anywhere in the domain, application, or HTTP response
layer. `ACTIVE + OFFLINE` is a valid, common combination, not a contradiction - see
[Lifecycle vs. health](#lifecycle-vs-health). A heartbeat never changes `InstallationStatus`.

## Config

`INSTALLATION_HEARTBEAT_INTERVAL_SECONDS` (default 60, documented client cadence, not enforced or
returned by the server), `INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS` (default 120),
`INSTALLATION_HEARTBEAT_OFFLINE_AFTER_SECONDS` (default 300) - loaded by
`loadInstallationHealthConfig` (`@pos-cloud/config`), independently of every other config group.
Validated: `stale > interval`, `offline > stale`. Wired via `InstallationHealthConfigModule`
(`@Global()`, mirrors `InstallationAuthConfigModule`), imported by `ControlPlaneModule`.

## Heartbeat contract

```
POST /api/v1/installation-health/heartbeat
@InstallationAuthenticated()
Content-Type: application/json
{ "appVersion": "1.4.2", "clientReportedAt": "2026-08-12T23:10:00.000Z" }

204 No Content
```

- `appVersion` (required): the one field with a real, current operational use - fleet rollout
  visibility. `platform` is not resent (already known and immutable on `Installation`); no device/host
  identifier (installation identity is already the credential); no uptime/local-DB-state/sync-state
  (would turn heartbeat into generic telemetry, no current consumer - see [Non-goals](#non-goals)).
- `clientReportedAt` (optional): diagnostic only, for client clock drift detection. **Never**
  authoritative for `lastSeenAt` or health - see [Server time authority](#server-time-authority).
- Identity comes exclusively from `@CurrentInstallation()` (the already-authenticated machine
  principal) - a body-supplied installation id is never accepted; the request DTO has no such
  property, so an attempted spoof is rejected outright by `forbidNonWhitelisted`.
- 204, not 200: no server-to-POS payload exists yet worth returning (no remote config, no command
  queue, no negotiated interval). A backward-compatible upgrade to 200 + body if a real need appears.
- No credential/ACTIVE/SUSPENDED/DECOMMISSIONED check inside `RecordInstallationHeartbeatUseCase` -
  `InstallationAuthGuard` is already the sole authority for machine authentication and status (401/403
  before the use case ever runs) - see [Error contracts](#error-contracts).
- Not audited - see [audit.md#non-goals](./audit.md#non-goals): heartbeats are telemetry, not
  administrative actions.

## Server time authority

`lastSeenAt` is always server-received time (`Clock.now()` inside `RecordInstallationHeartbeatUseCase`),
never the client-supplied `clientReportedAt`. A POS device's local clock is untrusted input - accepting
it as authoritative would let a misconfigured or malicious client claim `ONLINE` indefinitely
regardless of actual connectivity.

## Health model

```
computeInstallationHealth(lifecycleStatus, lastSeenAt, now, thresholds):

  SUSPENDED or DECOMMISSIONED           -> OFFLINE   (always, regardless of lastSeenAt)
  lastSeenAt == null                    -> NEVER_SEEN
  age(now, lastSeenAt) < staleAfter     -> ONLINE
  age < offlineAfter                    -> STALE
  else                                  -> OFFLINE
```

The single source of truth for lifecycle+heartbeat -> health, called from every read path (list,
single detail) - SQL and TypeScript can never duplicate/diverge on threshold logic. `PENDING` reaches
`NEVER_SEEN` structurally: no credential exists pre-activation, so a heartbeat is impossible until
`ACTIVE` - no explicit `PENDING` branch is needed.

`SUSPENDED`/`DECOMMISSIONED` always report `OFFLINE` regardless of how recent `lastSeenAt` is:
`InstallationAuthGuard` already rejects heartbeats from both (403) before any use case runs, so their
`lastSeenAt` is frozen at the moment of suspension - without this override, an installation suspended
seconds after a heartbeat would misleadingly show `ONLINE` next to `SUSPENDED`.

## Lifecycle vs. health

| Lifecycle status | Reported health                                                   |
| ---------------- | ----------------------------------------------------------------- |
| `PENDING`        | `NEVER_SEEN` (structurally guaranteed - no credential exists yet) |
| `ACTIVE`         | computed from `lastSeenAt` vs. thresholds                         |
| `SUSPENDED`      | always `OFFLINE`                                                  |
| `DECOMMISSIONED` | always `OFFLINE`                                                  |

## Data model

```sql
installations.installation_health (
  installation_id     uuid PRIMARY KEY REFERENCES installations.installations(id) ON DELETE CASCADE,
  first_seen_at        timestamptz NOT NULL,
  last_seen_at         timestamptz NOT NULL,
  client_reported_at   timestamptz NULL,
  app_version          varchar(50) NOT NULL
)
```

One row per installation, current-state only - no per-heartbeat history (see
[No heartbeat history](#no-heartbeat-history)). Lives in the existing `installations` schema, not a
new bounded context - see [ADR-015](../adr/ADR-015-installation-health-and-audit-strategy.md) for why
this is a deliberate deviation from ADR-007's forward-reserved `health` schema. No `status`/
`updated_at`/history columns: health is always computed at read time, never persisted.

## No heartbeat history

Every heartbeat updates the same one row - no row is ever inserted per ping. Deliberate: avoids
unbounded write-heavy growth for data with no established consumer need yet. `first_seen_at` is kept
as the one lightweight, genuinely useful historical fact ("when did this installation first come
online"), set once by the initial `INSERT` and never touched again.

## Concurrency

`TypeOrmInstallationHealthRepository.recordHeartbeat` is one atomic
`INSERT ... ON CONFLICT (installation_id) DO UPDATE` - never a read-then-write:

```sql
INSERT INTO installations.installation_health
  (installation_id, first_seen_at, last_seen_at, client_reported_at, app_version)
VALUES ($1, $2, $2, $3, $4)
ON CONFLICT (installation_id) DO UPDATE SET
  last_seen_at = GREATEST(installation_health.last_seen_at, EXCLUDED.last_seen_at),
  app_version = CASE
    WHEN EXCLUDED.last_seen_at >= installation_health.last_seen_at
    THEN EXCLUDED.app_version ELSE installation_health.app_version
  END,
  client_reported_at = CASE
    WHEN EXCLUDED.last_seen_at >= installation_health.last_seen_at
    THEN EXCLUDED.client_reported_at ELSE installation_health.client_reported_at
  END
```

`last_seen_at` uses `GREATEST()` so concurrent/out-of-order heartbeats can never regress it.
`app_version`/`client_reported_at` are tied to the _same_ winning row (whichever heartbeat has the
newest `receivedAt`), not updated independently of `last_seen_at` - a heartbeat that finishes
processing later but was sent earlier must never overwrite fresher data with stale data. `first_seen_at`
is absent from the `UPDATE SET` clause entirely, so only the initial `INSERT` ever sets it.

No worker-vs-heartbeat race exists by construction: health is computed at read time from a single
stored value, never written as a discrete state, so there is no "worker marks OFFLINE while a
heartbeat is landing" scenario to design around - see [Worker role](#worker-role).

## Worker role

`apps/worker` does not participate. No sweep job is needed to "notice" an installation went quiet -
the next admin read simply computes health fresh from `lastSeenAt`. Consistent with `apps/worker`'s
current "no business jobs scheduled" state (see [overview.md](./overview.md)).

## Health read API

- `GET /control-plane/installations/:id/health` - `installations.read` (reused, no new permission).
  Returns `{ installationId, lifecycleStatus, healthStatus, lastSeenAt, firstSeenAt, appVersion,
clientReportedAt }`. Two reads (Installation for lifecycle, `installation_health` for the snapshot) -
  a single detail view issuing 2 queries is normal, not the N+1 concern the list endpoint has to avoid.
- `GET /control-plane/installations` (list) - each item gains `healthStatus`/`lastSeenAt`, populated by
  a correlated scalar subquery against `installation_health` in `TypeOrmInstallationRepository.list()`
  (one query for the whole page - `GetInstallationHealthUseCase`/`ListInstallationsUseCase` are the only
  two call sites for `computeInstallationHealth`, so threshold logic can never diverge between them). Not
  a `.leftJoin()`: TypeORM's `getRawAndEntities()` switches to a two-query "ids in page, then hydrate"
  strategy whenever pagination (`skip`/`take`) is combined with any `.leftJoin()`, and that path resolves
  `orderBy` columns strictly by entity property path - `installation.createdAt`, not the `created_at` DB
  column name - which crashed in production before this was caught (see
  `typeorm-installation.repository.spec.ts`). A subquery in the SELECT list avoids that path entirely.

## Error contracts

Heartbeat with a revoked/unknown/malformed credential -> `401 INSTALLATION_CREDENTIAL_INVALID`.
`SUSPENDED` -> `403 INSTALLATION_SUSPENDED`. `DECOMMISSIONED` -> `403 INSTALLATION_DECOMMISSIONED`. All
three enforced entirely by the already-shipped `InstallationAuthGuard` (CLOUD-01C-C) - no duplicated
logic inside the heartbeat use case.

## OpenAPI

`installation-bearer` only on `POST /installation-health/heartbeat` - never `admin-bearer`.
`admin-bearer` only on `GET .../installations/:id/health` and the list endpoint - never
`installation-bearer`. The two schemes are never mixed on the same route.

## Test plan

Domain: every `computeInstallationHealth` branch and boundary (exact stale/offline thresholds).
Application/infra: first heartbeat, newer heartbeat advances `lastSeenAt`/`appVersion`/
`clientReportedAt`, an older heartbeat completing later never regresses any of the three (verified at
the SQL-shape level - see [Concurrency](#concurrency) - the same honest limitation as CLOUD-01C-C: no
real-PostgreSQL test harness exists in this repo, so true concurrent-transaction serialization stays
structurally-verified-only). HTTP: valid/revoked/SUSPENDED/DECOMMISSIONED/admin-JWT-rejected, identity
cannot be spoofed via the body, list/detail health fields, one query for the whole list page (no N+1).

## Non-goals

Heartbeat history, a worker sweep, dynamic interval negotiation, server-to-POS payload on heartbeat,
rate limiting on the heartbeat endpoint (documented backlog), `maxInstallations` race fix (unrelated,
pre-existing, documented backlog), periodic/automatic credential rotation (still CLOUD-01C-C's
non-goal), frontend, mobile, POS Desktop's own heartbeat sender implementation.
