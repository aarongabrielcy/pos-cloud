/**
 * Sanctioned exception to "persistence internals are never exported" (see index.ts's comment).
 * Exists solely so migration tooling can compose a real TypeORM DataSource with actual entity
 * metadata for `migration:generate` - see apps/migration-tooling/src/cli/entities.ts, the one
 * place outside this package allowed to import it. Not part of the public API surface (index.ts)
 * and not meant for any other consumer: apps/api relies on `autoLoadEntities` instead, never on
 * this file.
 */
export { InstallationRecord } from "./infrastructure/persistence/installation.record";
export { InstallationEnrollmentRecord } from "./infrastructure/persistence/installation-enrollment.record";
export { InstallationCredentialRecord } from "./infrastructure/persistence/installation-credential.record";
export { InstallationHealthRecord } from "./infrastructure/persistence/installation-health.record";
