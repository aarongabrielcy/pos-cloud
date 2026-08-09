# ADR-001: Modular Monolith before Microservices

## Status

Accepted

## Context

pos-cloud must eventually become a Vendor/Admin Control Plane, a Payment Orchestrator, and a
Premium Commerce Data Plane. These are three different concerns with potentially different SLAs,
failure domains, and scaling profiles. It would be tempting to start with separate services
(`payment-service`, `license-service`, `terminal-service`, ...) to "get the architecture right"
from day one.

At this stage there is no real traffic, no measured throughput difference between contexts, and no
team-ownership split. Building microservices now would mean paying full distributed-systems tax
(network calls where a function call would do, service discovery, distributed tracing, partial
failure handling, independent deployment pipelines) for problems that do not exist yet, while the
domain model itself is still being discovered.

## Decision

Build pos-cloud as a single deployable modular monolith with two processes (`apps/api`,
`apps/worker`) sharing one PostgreSQL database and one Redis instance. Bounded contexts are
enforced as internal module boundaries (see [ADR-007](./ADR-007-bounded-context-data-ownership.md)),
not network boundaries. No Kafka, RabbitMQ, NATS, Kubernetes, or Docker Swarm in this phase.

Extract a bounded context into its own service only when a concrete, observed criterion is met:

- **Independent scaling** - the context's load pattern diverges enough from the rest that scaling
  them together wastes resources or under-provisions one side.
- **Throughput/volume difference** - e.g. health telemetry ingestion growing orders of magnitude
  larger than control-plane request volume.
- **Different SLA** - e.g. payment authorization needing tighter latency/availability guarantees
  than admin tooling.
- **Different failure domain** - a provider outage (payments) must not be able to take down
  licensing or health.
- **Independent deployment cadence** - a context needs to ship far more (or less) often than the
  rest.
- **Security/compliance boundary** - e.g. PCI-relevant payment data warranting network isolation.
- **Independent storage** - a context's data access pattern no longer fits sharing the primary
  PostgreSQL instance well.
- **Independent team ownership** - a distinct team owns the context end-to-end and needs to move
  without coordinating every release with the rest.

## Consequences

- Faster iteration now; module boundaries (not network boundaries) are what get validated by
  [tests/architecture](../../tests/architecture/README.md).
- Extraction later is a refactor, not a rewrite, because bounded contexts already only talk to each
  other through contracts/ports/events (never direct table access) - see ADR-007.
- Until extraction, all contexts share fate on deploy and on infrastructure incidents; this is an
  accepted tradeoff for the current stage.
