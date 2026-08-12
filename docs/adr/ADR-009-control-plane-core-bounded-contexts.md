# ADR-009: Control Plane Core Bounded Contexts

## Status

Accepted

## Context

CLOUD-01A built the modular-monolith foundation with no commercial domain in it. The Control
Plane needs its first real domain model to become useful: who the customer is, what they're
licensed for, and where that license is deployed. These are three distinct concerns with distinct
lifecycles (a customer can exist with no license yet; a license can exist with zero installations;
an installation's activation is a separate future concern from its creation), and distinct rates
of change expected over time (installation telemetry/activation logic will grow fastest, per
[ADR-001](./ADR-001-modular-monolith-before-microservices.md)'s extraction criteria).

## Decision

Introduce three bounded contexts, each a real, independently buildable/testable pnpm package under
`libs/control-plane/`:

- **Customer Management** (`@pos-cloud/customer-management`) - owns the `Customer` aggregate.
- **Licensing** (`@pos-cloud/licensing`) - owns the `License` aggregate and its child
  `LicenseEntitlement` collection.
- **Installations** (`@pos-cloud/installations`) - owns the `Installation` aggregate.

Each follows Foundation's Hexagonal + Clean Architecture layering
([ADR-002](./ADR-002-hexagonal-clean-architecture.md)) internally: `domain/`, `application/`,
`infrastructure/`, `presentation/`. No aggregate root is shared between contexts, and no context
imports another's package directly - see
[ADR-010](./ADR-010-no-cross-bounded-context-database-foreign-keys.md) for the data-layer
consequence and `docs/architecture/control-plane-core.md` for the full cross-context port design
(`CustomerReaderPort`, `LicenseReaderPort`, each owned by its consumer, with the in-process adapter
wired only in `apps/api`'s composition root).

CQRS stays selective per [ADR-003](./ADR-003-selective-cqrs.md): commands and queries are
separated as distinct use case classes/folders (`application/use-cases`, informally split into
command-shaped and query-shaped classes) without a command/query bus. No `@nestjs/cqrs` dependency
was added - plain injectable use case classes were clearer for this stage's actual complexity.

## Consequences

- Each context can be tested, linted, and typechecked in complete isolation (proven: 39 tests for
  Customer Management, 48 for Licensing, 25 for Installations, all passing independently).
- Adding a fourth context later (e.g. a future Support or Audit context) follows the exact same
  package/layering template.
- The three contexts still share one PostgreSQL instance and one API process deployment - this ADR
  does not extract anything; it only makes the boundaries real and enforced
  (`tests/architecture`'s dependency-cruiser rules), preparing for the extraction ADR-001 already
  anticipates.
- Some structural duplication is accepted by design: Licensing and Installations each define their
  own `CustomerReaderPort` interface (identical shape, separate declarations) rather than sharing
  one type, because the consumer-owns-the-port rule matters more than avoiding a few duplicated
  lines - see ADR-010 discussion in control-plane-core.md.
