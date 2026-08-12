# Migrations

## `1786312046358-CreateControlPlaneCore.ts` (CLOUD-01B)

Creates the first three bounded-context schemas and tables: `control_plane.customers`,
`licensing.licenses`, `licensing.license_entitlements`, `installations.installations`. See
[docs/architecture/control-plane-data-model.md](../../../../docs/architecture/control-plane-data-model.md)
for the full column/constraint/index list and an ER diagram. **Not executed** - the user runs
`pnpm migration:run` when ready.

Rules (see [docs/architecture/overview.md](../../../../docs/architecture/overview.md) and
[ADR-006](../../../../docs/adr/ADR-006-external-configuration-and-secrets.md)):

- `synchronize` is permanently `false`.
- `migrationsRun` is permanently `false` - migrations never run implicitly on boot.
- Only the user runs `migration:run` / `migration:revert`, using the scripts documented in the
  root [README.md](../../../../README.md).
- No migration is generated or committed until a real table/entity exists to justify it.
