# ADR-010: No Cross-Bounded-Context Database Foreign Keys

## Status

Accepted

## Context

`licensing.licenses.customer_id` references a customer that lives in `control_plane.customers`;
`installations.installations.customer_id` and `.license_id` similarly reference rows owned by other
bounded contexts. A PostgreSQL foreign key across these schemas would be the "obvious" way to keep
that referential integrity - and would also permanently couple the three contexts at the database
level, making [ADR-001](./ADR-001-modular-monolith-before-microservices.md)'s future extraction
seam fictional: a bounded context cannot get its own database later if another schema holds a live
FK into its tables.

[ADR-007](./ADR-007-bounded-context-data-ownership.md) (CLOUD-01A) already established this
principle in the abstract, before any table existed. This ADR is its concrete application now that
real tables do.

## Decision

- **Within** a bounded context, foreign keys are used normally:
  `licensing.license_entitlements.license_id -> licensing.licenses.id`, `ON DELETE CASCADE`, is the
  one FK this migration creates.
- **Across** bounded contexts, every reference is a plain `uuid` column with no FK:
  `licenses.customer_id`, `installations.customer_id`, `installations.license_id`. See
  [control-plane-data-model.md](../architecture/control-plane-data-model.md) for the full column
  list and an ER diagram marking exactly which lines are real FKs.
- Referential integrity for these cross-context references is enforced at the **application**
  layer, through the port pattern in `docs/architecture/control-plane-core.md`
  (`CustomerReaderPort`, `LicenseReaderPort`): `CreateLicense` checks the customer exists and is
  ACTIVE before saving; `CreateInstallation` checks the customer, the license, that the license
  belongs to that customer, and that the license is usable - all before a row is written. Nothing
  downstream (a direct SQL write, a future admin tool) is protected by the database itself; that
  tradeoff is accepted deliberately for the extraction seam it preserves.

**Note (CLOUD-01B-FIX):** this decision is scoped to _cross-context_ references only. Same-row,
same-context invariants (identifier formats, the edition⇒licenseModel commercial rule, entitlement
`code`/`configuration` shape, trimmed-string floors) **are** enforced by PostgreSQL `CHECK`
constraints as defense-in-depth alongside Domain validation - see
[control-plane-data-model.md](../architecture/control-plane-data-model.md). Only referential
integrity _across_ schemas is deliberately left to the application layer.

## Consequences

- Extracting Licensing or Installations into its own database later requires no FK cleanup -
  there is none to clean up.
- A row can, in principle, end up referencing a `customer_id` that was later deleted - moot today,
  since there is no customer DELETE API (see ADR on Customer Management: no physical delete, only
  status transitions to INACTIVE, which is terminal).
- Concurrent-write edge cases (e.g. a license being created in the same instant its customer is
  suspended) are a known, accepted risk at this stage - see the concurrency note in
  `docs/architecture/control-plane-core.md` and the `CreateLicense`/`CreateInstallation` use case
  comments. No distributed lock or saga is introduced to close this window now.
- Every query that would have been a cheap SQL JOIN across these tables must instead go through an
  application-layer port call (see `LicenseReaderPort`/`CustomerReaderPort`) or be composed at the
  presentation/reporting layer later - accepted as the cost of keeping contexts genuinely
  independent.
