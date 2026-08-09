# ADR-006: External Configuration and Secrets Outside the Repository

## Status

Accepted

## Context

Database credentials, and eventually provider API keys/OAuth secrets, must never be committed to
the repository, printed in logs, or exposed in CI output. Development environments still need a
consistent, working configuration without every contributor hand-rolling their own `.env`.

## Decision

- Real configuration for local development lives outside this repository, at
  `../config/pos-cloud/` (`infrastructure.env`, `api.env`, `worker.env` relative to the repo root),
  and is consumed by `docker-compose.yml` via `env_file`. These files are never copied into the
  repo, never printed, and never committed.
- The repository only ships `.env.example`, listing variable **names** with non-sensitive
  placeholders - never real credentials.
- Configuration is centralized, typed, and validated at process startup via `libs/config` (zod).
  An invalid or incomplete environment fails the process before it starts listening or connecting
  to anything (fail-fast).
- Structured logging (`libs/observability`) ships with redaction paths configured for
  `authorization`, `cookie`, `set-cookie`, `password`, `access_token`, `refresh_token`, and
  `client_secret` from day one, even though most of these fields don't exist as features yet - so a
  future feature that introduces one of them inherits redaction automatically instead of needing to
  remember to add it.
- Request bodies are not logged wholesale by default.

Critical persistent integrations (once introduced - payments, licensing writes, sync) **must** use
a transactional outbox/inbox pattern rather than fire-and-forget publication. No outbox/inbox table
exists yet in CLOUD-01A because no real flow needs one; this requirement is documented now so it
isn't skipped when the first critical flow lands.

## Consequences

- Onboarding a new contributor means pointing them at the external config directory, not sharing
  secrets through the repo or chat.
- A misconfigured environment is caught immediately at boot with a clear (value-free) error message,
  not as a runtime failure deep in a request handler.
- Adding a new sensitive field later (e.g. an OAuth `refresh_token` for a payment provider) already
  has a redaction path ready; the corresponding config schema/validation should be added at the same
  time the field is introduced.
