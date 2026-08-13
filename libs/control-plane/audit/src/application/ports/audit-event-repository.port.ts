import type { AuditActorType, PaginatedResult, PaginationParams } from "@pos-cloud/shared-kernel";
import type { AuditEvent } from "../../domain/audit-event";

export interface AuditEventFilters {
  readonly actorType?: AuditActorType;
  readonly actorId?: string;
  readonly action?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly correlationId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface ListAuditEventsCriteria extends PaginationParams, AuditEventFilters {}

export interface AuditEventRepository {
  insert(event: AuditEvent): Promise<void>;
  /** Ordered occurred_at DESC, id DESC for stable pagination even when timestamps tie - see section 38. */
  list(criteria: ListAuditEventsCriteria): Promise<PaginatedResult<AuditEvent>>;
}

export const AUDIT_EVENT_REPOSITORY = Symbol("AUDIT_EVENT_REPOSITORY");
