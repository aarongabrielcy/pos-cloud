import { Inject, Injectable } from "@nestjs/common";
import type { AuditActorType, PaginatedResult } from "@pos-cloud/shared-kernel";
import { normalizePagination } from "@pos-cloud/shared-kernel";
import type { AuditEvent } from "../../domain/audit-event";
import {
  AUDIT_EVENT_REPOSITORY,
  type AuditEventRepository,
} from "../ports/audit-event-repository.port";

export interface ListAuditEventsQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly actorType?: AuditActorType;
  readonly actorId?: string;
  readonly action?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly correlationId?: string;
  readonly from?: Date;
  readonly to?: Date;
}

/** Admin-only read side (audit.read) - filters only, no full-text search, no arbitrary metadata query (section 30/35). */
@Injectable()
export class ListAuditEventsUseCase {
  constructor(@Inject(AUDIT_EVENT_REPOSITORY) private readonly repository: AuditEventRepository) {}

  async execute(query: ListAuditEventsQuery): Promise<PaginatedResult<AuditEvent>> {
    const pagination = normalizePagination(query);

    return this.repository.list({
      ...pagination,
      actorType: query.actorType,
      actorId: query.actorId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      correlationId: query.correlationId,
      from: query.from,
      to: query.to,
    });
  }
}
