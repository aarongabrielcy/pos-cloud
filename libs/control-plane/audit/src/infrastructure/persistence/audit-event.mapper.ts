import type { AuditActorType } from "@pos-cloud/shared-kernel";
import type { AuditEvent } from "../../domain/audit-event";
import { AuditEventRecord } from "./audit-event.record";

export class AuditEventMapper {
  static toDomain(record: AuditEventRecord): AuditEvent {
    return {
      id: record.id,
      occurredAt: record.occurredAt,
      actorType: record.actorType as AuditActorType,
      actorId: record.actorId,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      correlationId: record.correlationId,
      metadata: record.metadata,
    };
  }

  static toRecord(event: AuditEvent): AuditEventRecord {
    const record = new AuditEventRecord();
    record.id = event.id;
    record.occurredAt = event.occurredAt;
    record.actorType = event.actorType;
    record.actorId = event.actorId;
    record.action = event.action;
    record.resourceType = event.resourceType;
    record.resourceId = event.resourceId;
    record.correlationId = event.correlationId;
    record.metadata = event.metadata as Record<string, unknown>;
    return record;
  }
}
