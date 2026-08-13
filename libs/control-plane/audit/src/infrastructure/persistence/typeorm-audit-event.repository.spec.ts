import type { Repository } from "typeorm";
import type { AuditEvent } from "../../domain/audit-event";
import { AuditEventRecord } from "./audit-event.record";
import { TypeOrmAuditEventRepository } from "./typeorm-audit-event.repository";

function buildEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
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

function buildQueryBuilder(records: AuditEventRecord[]) {
  const qb: Record<string, jest.Mock> = {};
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.addOrderBy = jest.fn().mockReturnValue(qb);
  qb.skip = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.getManyAndCount = jest.fn().mockResolvedValue([records, records.length]);
  return qb;
}

describe("TypeOrmAuditEventRepository", () => {
  describe("insert", () => {
    it("persists the event via the repository (never update/delete)", async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const ormRepository = { save } as unknown as Repository<AuditEventRecord>;
      const repository = new TypeOrmAuditEventRepository(ormRepository);

      await repository.insert(buildEvent());

      expect(save).toHaveBeenCalledTimes(1);
      const [record] = save.mock.calls[0];
      expect(record).toBeInstanceOf(AuditEventRecord);
      expect(record.id).toBe("event-1");
    });
  });

  describe("list", () => {
    it("orders by occurred_at DESC, id DESC for stable pagination", async () => {
      const qb = buildQueryBuilder([]);
      const ormRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<AuditEventRecord>;
      const repository = new TypeOrmAuditEventRepository(ormRepository);

      await repository.list({ page: 1, pageSize: 25 });

      expect(qb.orderBy).toHaveBeenCalledWith("event.occurred_at", "DESC");
      expect(qb.addOrderBy).toHaveBeenCalledWith("event.id", "DESC");
    });

    it("applies every provided filter", async () => {
      const qb = buildQueryBuilder([]);
      const ormRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<AuditEventRecord>;
      const repository = new TypeOrmAuditEventRepository(ormRepository);

      await repository.list({
        page: 1,
        pageSize: 25,
        actorType: "ADMIN",
        actorId: "admin-1",
        action: "customer.created",
        resourceType: "Customer",
        resourceId: "customer-1",
        correlationId: "correlation-1",
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-02T00:00:00.000Z"),
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(8);
    });

    it("paginates correctly", async () => {
      const qb = buildQueryBuilder([]);
      const ormRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
      } as unknown as Repository<AuditEventRecord>;
      const repository = new TypeOrmAuditEventRepository(ormRepository);

      await repository.list({ page: 3, pageSize: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(10);
    });
  });
});
