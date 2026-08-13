import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import type { AuditEvent } from "../domain/audit-event";
import type {
  AuditEventRepository,
  ListAuditEventsCriteria,
} from "../application/ports/audit-event-repository.port";

/** Test double for AuditEventRepository - never used in production code. */
export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly events: AuditEvent[] = [];

  async insert(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async list(criteria: ListAuditEventsCriteria): Promise<PaginatedResult<AuditEvent>> {
    let items = [...this.events];

    if (criteria.actorType) {
      items = items.filter((event) => event.actorType === criteria.actorType);
    }
    if (criteria.actorId) {
      items = items.filter((event) => event.actorId === criteria.actorId);
    }
    if (criteria.action) {
      items = items.filter((event) => event.action === criteria.action);
    }
    if (criteria.resourceType) {
      items = items.filter((event) => event.resourceType === criteria.resourceType);
    }
    if (criteria.resourceId) {
      items = items.filter((event) => event.resourceId === criteria.resourceId);
    }
    if (criteria.correlationId) {
      items = items.filter((event) => event.correlationId === criteria.correlationId);
    }
    if (criteria.from) {
      items = items.filter((event) => event.occurredAt >= criteria.from!);
    }
    if (criteria.to) {
      items = items.filter((event) => event.occurredAt <= criteria.to!);
    }

    items.sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id),
    );

    const total = items.length;
    const start = (criteria.page - 1) * criteria.pageSize;
    const page = items.slice(start, start + criteria.pageSize);

    return buildPaginatedResult(page, total, criteria);
  }
}
