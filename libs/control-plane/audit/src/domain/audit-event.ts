import type { AuditActorType } from "@pos-cloud/shared-kernel";

/**
 * Plain, framework-free data shape - no domain logic exists beyond "these fields are set once at
 * creation" (append-only, no state transitions), so a full aggregate class with a private
 * constructor would be pure ceremony. Used for both the write path (built once inside
 * AuditRecorderAdapter) and the read path (returned by AuditEventRepository.list).
 */
export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorType: AuditActorType;
  readonly actorId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly correlationId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}
