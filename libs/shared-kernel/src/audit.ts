/**
 * Cross-bounded-context audit contract (CLOUD-01C-D). Every producer context (customer-management,
 * licensing, installations, access-management) depends on this port; the audit bounded context
 * provides the real implementation. Living here - not inside the audit package - lets producers
 * depend on the contract without importing audit's internals, mirroring how
 * IS_INSTALLATION_ENROLLMENT_KEY/IS_INSTALLATION_AUTHENTICATED_KEY already solve the same
 * two-context-agree-without-importing-each-other problem for installation auth. Framework-free: no
 * NestJS/Express types anywhere in this file.
 */
export type AuditActorType = "ADMIN" | "INSTALLATION" | "SYSTEM";

/**
 * A fully-resolved actor, known up front by the caller (the common case - an admin-authenticated
 * controller already knows adminUserId before calling the use case).
 */
export interface AuditActorContext {
  readonly actorType: AuditActorType;
  readonly actorId: string | null;
  readonly correlationId: string;
}

/**
 * For the rarer case where the actor is NOT yet known at the presentation layer (e.g.
 * EnrollInstallationUseCase: the controller has only an opaque enrollment code, not an
 * installationId, until the use case itself resolves one) - only the request-scoped correlationId
 * is available up front. The use case builds its own AuditActorContext once it legitimately
 * resolves the actor, and calls the port itself.
 */
export interface AuditRequestContext {
  readonly correlationId: string;
}

export interface AuditEventInput {
  readonly actor: AuditActorContext;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  /** Small, explicit, per-action-whitelisted context - never a raw request body/entity dump. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Best-effort, non-blocking (CLOUD-01C-D V1 - no Outbox, see ADR-015): `record()` MUST NEVER
 * reject. A real implementation catches its own persistence errors, logs them safely (never
 * dumping metadata), and resolves regardless - a transient audit-write failure must never fail the
 * business action that triggered it. Callers `await` this call for predictable ordering, not for
 * error handling.
 */
export interface AuditRecorderPort {
  record(input: AuditEventInput): Promise<void>;
}

export const AUDIT_RECORDER_PORT = Symbol("AUDIT_RECORDER_PORT");
