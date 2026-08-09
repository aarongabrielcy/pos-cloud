# ADR-002: Hexagonal + Clean Architecture

## Status

Accepted

## Context

Bounded contexts will eventually hold real business rules (licensing entitlements, payment
orchestration policy, sync conflict resolution). Coupling that logic directly to NestJS decorators,
TypeORM entities, or a specific payment SDK makes it hard to test in isolation, hard to reason
about, and hard to extract into a separate service later (ADR-001).

## Decision

Every bounded context (once introduced) is internally layered as:

- **Domain** - entities, value objects, domain services, domain events. Zero framework
  dependencies: no NestJS, TypeORM, PostgreSQL, Redis, HTTP, Axios, or any external SDK.
- **Application** - use cases that orchestrate Domain objects. May depend on Domain and on ports
  (interfaces) it defines; never on a concrete Infrastructure implementation.
- **Infrastructure** - implements the ports Application/Domain define (repositories, external API
  clients, provider adapters), pointing inward per the Dependency Inversion Principle.
- **Presentation** - HTTP controllers (NestJS) that depend on Application, translating
  transport-level requests into use case calls.

TypeORM decorators never appear on a Domain Entity. Persistence uses a distinct Persistence Record
class connected to the Domain Entity through an explicit Mapper (documented in
[docs/architecture/overview.md](../architecture/overview.md)).

This is enforced automatically, not just documented: `tests/architecture` runs dependency-cruiser
against the real import graph and fails the build on a real violation (e.g. a rule blocking any
future `.../domain/...` module from importing a `.../infrastructure/...` module).

## Consequences

- Domain and Application code is unit-testable without a database, an HTTP server, or Redis.
- Swapping an adapter (e.g. a different payment provider, later Mercado Pago and A910) means writing
  a new Infrastructure implementation of an existing port, not touching Domain/Application.
- More files/indirection than a "just put everything in the controller" approach - accepted, because
  the contexts that most need this (Payment Orchestrator) are exactly the ones where correctness and
  testability matter most.
