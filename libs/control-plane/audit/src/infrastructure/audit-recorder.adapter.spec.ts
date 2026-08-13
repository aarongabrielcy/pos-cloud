import type { Clock, IdGenerator } from "@pos-cloud/shared-kernel";
import type { AuditEventRepository } from "../application/ports/audit-event-repository.port";
import { AuditRecorderAdapter } from "./audit-recorder.adapter";

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

function fixedClock(): Clock {
  return { now: () => FIXED_NOW };
}

function fixedIdGenerator(id = "event-1"): IdGenerator {
  return { next: () => id };
}

describe("AuditRecorderAdapter", () => {
  it("inserts a fully-built AuditEvent with server-stamped id/occurredAt", async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const repository: AuditEventRepository = { insert, list: jest.fn() };
    const adapter = new AuditRecorderAdapter(repository, fixedClock(), fixedIdGenerator());

    await adapter.record({
      actor: { actorType: "ADMIN", actorId: "admin-1", correlationId: "correlation-1" },
      action: "customer.created",
      resourceType: "Customer",
      resourceId: "customer-1",
      metadata: { foo: "bar" },
    });

    expect(insert).toHaveBeenCalledWith({
      id: "event-1",
      occurredAt: FIXED_NOW,
      actorType: "ADMIN",
      actorId: "admin-1",
      action: "customer.created",
      resourceType: "Customer",
      resourceId: "customer-1",
      correlationId: "correlation-1",
      metadata: { foo: "bar" },
    });
  });

  it("resolves (never rejects) when the repository insert fails - the contract AuditRecorderPort requires", async () => {
    const insert = jest.fn().mockRejectedValue(new Error("connection reset"));
    const repository: AuditEventRepository = { insert, list: jest.fn() };
    const adapter = new AuditRecorderAdapter(repository, fixedClock(), fixedIdGenerator());

    await expect(
      adapter.record({
        actor: { actorType: "ADMIN", actorId: "admin-1", correlationId: "correlation-1" },
        action: "customer.created",
        resourceType: "Customer",
        resourceId: "customer-1",
        metadata: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("logs a safe error (action/resourceType/resourceId/correlationId/actor) without dumping metadata", async () => {
    const insert = jest.fn().mockRejectedValue(new Error("connection reset"));
    const repository: AuditEventRepository = { insert, list: jest.fn() };
    const adapter = new AuditRecorderAdapter(repository, fixedClock(), fixedIdGenerator());
    const errorSpy = jest.spyOn(
      (adapter as unknown as { logger: { error: jest.Mock } }).logger,
      "error",
    );

    await adapter.record({
      actor: { actorType: "ADMIN", actorId: "admin-1", correlationId: "correlation-1" },
      action: "customer.created",
      resourceType: "Customer",
      resourceId: "customer-1",
      metadata: { secretLookingField: "should-never-appear-in-logs" },
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [logged] = errorSpy.mock.calls[0];
    expect(logged).toContain("action=customer.created");
    expect(logged).toContain("resourceType=Customer");
    expect(logged).toContain("resourceId=customer-1");
    expect(logged).toContain("correlationId=correlation-1");
    expect(logged).not.toContain("should-never-appear-in-logs");
  });
});
