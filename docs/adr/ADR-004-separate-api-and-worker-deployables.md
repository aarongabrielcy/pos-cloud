# ADR-004: Separate API and Worker Deployables

## Status

Accepted

## Context

pos-cloud needs an HTTP-facing process for synchronous requests, and it will eventually need
background processing (outbox dispatch, retries, reconciliation, scheduled operations) that should
not compete with request latency or be coupled to HTTP request/response lifecycles.

## Decision

Ship two deployable processes from the same modular monolith codebase:

- `apps/api` - NestJS HTTP process.
- `apps/worker` - NestJS application-context process (no HTTP server), for background processing.

They are not microservices: same repository, same release, same shared `libs/*` packages, same
database and Redis instance. They can, however, be scaled and deployed independently as processes
(e.g. more worker replicas during a backfill, without touching API replica count).

In CLOUD-01A the worker has no business jobs - it only proves out configuration loading, logging,
PostgreSQL/Redis connectivity, and graceful shutdown, plus a standalone `healthcheck.ts` script (no
HTTP port opened solely for a healthcheck). Real jobs (outbox processing, retries, reconciliation)
land in later CLOUD tasks once there is a real flow that needs them.

## Consequences

- Background work will never block or be blocked by HTTP request handling.
- Two processes to run in `docker-compose.yml` and in any future deployment target, each with its
  own health/readiness semantics.
- Both processes must stay in sync on shared configuration/schema assumptions since they read the
  same database - enforced by both depending on the single `libs/database` DataSource
  configuration, never duplicating connection logic.
