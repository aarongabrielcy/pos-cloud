// Public API of @pos-cloud/audit.
// Deliberately excluded: infrastructure/persistence and presentation/http internals.
// AuditRecorderPort/AuditActorContext/AUDIT_RECORDER_PORT live in @pos-cloud/shared-kernel, not
// here - every producer bounded context depends on shared-kernel's contract, never on this package.

export { AuditModule } from "./audit.module";

export { ListAuditEventsUseCase } from "./application/use-cases/list-audit-events.use-case";
export type { ListAuditEventsQuery } from "./application/use-cases/list-audit-events.use-case";

export type { AuditEvent } from "./domain/audit-event";

// Exported solely so composition-root-level HTTP tests (apps/api) can
// `.overrideProvider(AUDIT_EVENT_REPOSITORY)` with a fake and drive the real AuditModule wiring
// end-to-end without a PostgreSQL connection - the same reason installations exports
// INSTALLATION_CREDENTIAL_VERIFIER.
export {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
  type AuditEventFilters,
  type ListAuditEventsCriteria,
} from "./application/ports/audit-event-repository.port";
