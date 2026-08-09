# ADR-007: Bounded-Context Data Ownership and Microservice Extraction Criteria

## Status

Accepted

## Context

Running as a modular monolith (ADR-001) only pays off if bounded contexts stay decoupled at the
data layer too. If any context can query another context's tables directly, or join across them,
the codebase becomes a distributed monolith in waiting - all the coupling of a single database with
none of the safety of enforced boundaries, and extraction later becomes a rewrite instead of a
refactor.

## Decision

- Each bounded context owns its own PostgreSQL schema. Planned schemas (not created until their
  owning context is implemented): `control_plane`, `licensing`, `installations`, `health`,
  `support`, `updates`, `audit`, `payments`.
- Foreign keys are allowed **within** a bounded context's own schema.
- Foreign keys are **never** created across bounded-context schemas. Cross-context references use
  global IDs plus explicit contracts (public interfaces), application ports, domain/application
  events, or read-side projections - never a direct join into another context's tables.
- No repository joins arbitrarily across bounded-context schemas.
- Communication between contexts today is in-process (public contracts, ports, events). If/when a
  context is extracted into its own service, that same contract becomes the shape of an HTTP/gRPC
  call or an async message - the seam already exists, only the transport changes.

Extraction criteria (also recorded in [ADR-001](./ADR-001-modular-monolith-before-microservices.md)):
independent scaling need, throughput/volume divergence, differing SLA, differing failure domain,
independent deployment cadence, security/compliance boundary, independent storage need, and
independent team ownership. A context is a candidate for extraction when one or more of these is
concretely observed - not preemptively.

## Consequences

- Data ownership boundaries are decided now, before any table exists, so the first migration in
  CLOUD-01B already lands in the right schema instead of needing a later cleanup.
- Some duplication of IDs/denormalized data across contexts is expected and accepted, in exchange
  for not coupling contexts at the database level.
- Extracting a bounded context later mainly means moving its schema to its own database and
  swapping its in-process contract implementation for a network one - the domain/application code
  itself should not need to change.
