# Migrations

No migrations exist yet. This directory is the target for TypeORM migration files once
CLOUD-01B introduces the first real domain models.

Rules (see [docs/architecture/overview.md](../../../../docs/architecture/overview.md) and
[ADR-006](../../../../docs/adr/ADR-006-external-configuration-and-secrets.md)):

- `synchronize` is permanently `false`.
- `migrationsRun` is permanently `false` - migrations never run implicitly on boot.
- Only the user runs `migration:run` / `migration:revert`, using the scripts documented in the
  root [README.md](../../../../README.md).
- No migration is generated or committed until a real table/entity exists to justify it.
