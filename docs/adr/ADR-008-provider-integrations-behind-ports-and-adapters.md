# ADR-008: Provider Integrations Behind Ports/Adapters

## Status

Accepted

## Context

The Payment Orchestrator will eventually integrate multiple payment providers (starting with
Mercado Pago and the Point A910 terminal, implemented in a later CLOUD task - not this one). If
provider-specific SDKs/HTTP clients leak into Application or Domain code, adding a second provider
means touching business logic, and testing payment flows means mocking a third-party SDK instead of
a small interface.

## Decision

Every external provider (payment gateway, terminal hardware, and by the same principle any future
external system) is integrated behind a Port defined in Application/Domain, with the concrete SDK
or HTTP client living entirely in an Infrastructure Adapter that implements that port. Domain and
Application code call the port, never the provider SDK directly.

This ADR does not implement Mercado Pago or the A910 terminal - that is explicitly out of scope for
CLOUD-01A. It records the pattern those future adapters must follow when CLOUD-03 introduces them.

## Consequences

- Adding a second or third payment provider means writing a new adapter against an existing port,
  not modifying Payment Orchestrator business logic.
- Payment Orchestrator use cases are testable against a fake/in-memory adapter, without needing
  live provider credentials or network access.
- The port's shape must be designed to fit the _domain's_ needs (authorize, capture, refund, etc.),
  not mirror any single provider's API shape - avoiding a port that is really just Mercado Pago's
  API renamed.
