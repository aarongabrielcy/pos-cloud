# ADR-003: Selective CQRS

## Status

Accepted

## Context

CQRS (separate command/query models) gives real benefits when a context has meaningfully divergent
read and write shapes, or needs independent scaling of reads vs. writes. Applied uniformly to every
operation - including simple CRUD-like admin flows - it adds ceremony (separate Command/Query
classes, handlers, buses) without a corresponding benefit, and slows down building the Control
Plane's straightforward flows.

## Decision

CQRS is applied selectively, not ceremonially. A given use case gets a Command/Query split only
when it earns it - e.g., a read model that is shaped very differently from the write model, or a
query with performance/scaling needs distinct from the corresponding writes. Simple use cases stay
as plain Application services with a single method, without an artificial split.

No CQRS framework (e.g. `@nestjs/cqrs`) is adopted wholesale in CLOUD-01A. If/when a use case
justifies the split, it is implemented directly (explicit Command/Query objects and handlers) so
the decision stays visible and deliberate rather than hidden behind a generic framework applied
everywhere.

## Consequences

- Less boilerplate for the majority of Control Plane operations.
- The team must judge, case by case, whether a use case needs the split - this ADR does not
  prescribe a mechanical rule, only the principle: don't apply CQRS ceremony where it doesn't earn
  its cost.
- Revisit if/when a context (most likely Payment Orchestrator or Premium Data Plane) develops a
  read model that diverges sharply enough from its write model to need eventual consistency via
  projections.
