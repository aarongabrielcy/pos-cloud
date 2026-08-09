# ADR-005: PostgreSQL + Redis

## Status

Accepted

## Context

pos-cloud needs a durable system of record for commercial/control-plane data, and fast
infrastructure for caching, ephemeral state, and future job/retry coordination. It does not need
either of those roles played by more than one technology at this stage.

## Decision

- **PostgreSQL 16** (`postgres:16-alpine`) is the single system of record, accessed through
  TypeORM. `synchronize` and `migrationsRun` are permanently `false` in every environment - schema
  changes only happen through a migration the user runs explicitly (`migration:run`); nothing in
  the codebase runs a migration automatically on boot. No business tables exist yet; they arrive
  starting CLOUD-01B, each owned by its bounded context (see
  [ADR-007](./ADR-007-bounded-context-data-ownership.md)).
- **Redis 7** (`redis:7-alpine`) is infrastructure for caching, ephemeral state, distributed locks,
  and future job/retry scheduling - never a system of record. No BullMQ or other queue is
  introduced until a real background job exists to justify it.

Pinned minor versions (`16-alpine`, `7-alpine`), never `:latest`, so infrastructure upgrades are a
deliberate, reviewed change rather than an implicit one on next container pull.

## Consequences

- A single reusable `DataSource` configuration (`libs/database`) is shared by `apps/api`,
  `apps/worker`, and the migration CLI, so connection/pooling/migration behavior cannot drift
  between processes.
- No implicit schema drift is possible: a missing migration means a missing table, not a
  silently-synced one.
- Any future move toward a different storage engine for a specific bounded context (e.g. a
  time-series store for health telemetry) is a deliberate, separately-decided change, not an
  accidental consequence of this ADR.
