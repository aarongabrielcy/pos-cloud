import type { AuditEvent } from "../../domain/audit-event";
import { AuditEventMapper } from "./audit-event.mapper";

describe("AuditEventMapper", () => {
  it("round-trips domain -> record -> domain", () => {
    const event: AuditEvent = {
      id: "event-1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      actorType: "ADMIN",
      actorId: "admin-1",
      action: "customer.status.changed",
      resourceType: "Customer",
      resourceId: "customer-1",
      correlationId: "correlation-1",
      metadata: { from: "ACTIVE", to: "SUSPENDED" },
    };

    const record = AuditEventMapper.toRecord(event);
    const roundTripped = AuditEventMapper.toDomain(record);

    expect(roundTripped).toEqual(event);
  });

  it("maps a null actorId through unchanged (SYSTEM actor)", () => {
    const event: AuditEvent = {
      id: "event-1",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      actorType: "SYSTEM",
      actorId: null,
      action: "customer.created",
      resourceType: "Customer",
      resourceId: "customer-1",
      correlationId: "correlation-1",
      metadata: {},
    };

    const record = AuditEventMapper.toRecord(event);

    expect(record.actorId).toBeNull();
    expect(AuditEventMapper.toDomain(record).actorId).toBeNull();
  });
});
