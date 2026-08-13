import type { AuditEvent } from "../../domain/audit-event";
import { InMemoryAuditEventRepository } from "../../test-support/in-memory-audit-event-repository";
import { ListAuditEventsUseCase } from "./list-audit-events.use-case";

function buildEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: "event-1",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    actorType: "ADMIN",
    actorId: "admin-1",
    action: "customer.created",
    resourceType: "Customer",
    resourceId: "customer-1",
    correlationId: "correlation-1",
    metadata: {},
    ...overrides,
  };
}

describe("ListAuditEventsUseCase", () => {
  it("honors the default pagination contract", async () => {
    const repository = new InMemoryAuditEventRepository();
    await repository.insert(buildEvent({ id: "event-1" }));
    const useCase = new ListAuditEventsUseCase(repository);

    const result = await useCase.execute({});

    expect(result).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    expect(result.items).toHaveLength(1);
  });

  it("filters by actorType", async () => {
    const repository = new InMemoryAuditEventRepository();
    await repository.insert(buildEvent({ id: "event-1", actorType: "ADMIN" }));
    await repository.insert(
      buildEvent({ id: "event-2", actorType: "INSTALLATION", actorId: "installation-1" }),
    );
    const useCase = new ListAuditEventsUseCase(repository);

    const result = await useCase.execute({ actorType: "INSTALLATION" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("event-2");
  });

  it("filters by resourceType and resourceId", async () => {
    const repository = new InMemoryAuditEventRepository();
    await repository.insert(
      buildEvent({ id: "event-1", resourceType: "Customer", resourceId: "a" }),
    );
    await repository.insert(
      buildEvent({ id: "event-2", resourceType: "License", resourceId: "b" }),
    );
    const useCase = new ListAuditEventsUseCase(repository);

    const result = await useCase.execute({ resourceType: "License", resourceId: "b" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("event-2");
  });

  it("filters by correlationId", async () => {
    const repository = new InMemoryAuditEventRepository();
    await repository.insert(buildEvent({ id: "event-1", correlationId: "corr-a" }));
    await repository.insert(buildEvent({ id: "event-2", correlationId: "corr-b" }));
    const useCase = new ListAuditEventsUseCase(repository);

    const result = await useCase.execute({ correlationId: "corr-b" });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("event-2");
  });

  it("filters by date range", async () => {
    const repository = new InMemoryAuditEventRepository();
    await repository.insert(
      buildEvent({ id: "old", occurredAt: new Date("2025-01-01T00:00:00.000Z") }),
    );
    await repository.insert(
      buildEvent({ id: "new", occurredAt: new Date("2026-06-01T00:00:00.000Z") }),
    );
    const useCase = new ListAuditEventsUseCase(repository);

    const result = await useCase.execute({ from: new Date("2026-01-01T00:00:00.000Z") });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("new");
  });
});
