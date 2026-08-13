import type { DataSource, Repository } from "typeorm";
import { InstallationHealthRecord } from "./installation-health.record";
import { TypeOrmInstallationHealthRepository } from "./typeorm-installation-health.repository";

function buildRepository(findOneResult: InstallationHealthRecord | null = null) {
  const query = jest.fn().mockResolvedValue([]);
  const findOne = jest.fn().mockResolvedValue(findOneResult);
  const dataSource = { query } as unknown as DataSource;
  const ormRepository = { findOne } as unknown as Repository<InstallationHealthRecord>;
  const repository = new TypeOrmInstallationHealthRepository(dataSource, ormRepository);
  return { repository, query, findOne };
}

describe("TypeOrmInstallationHealthRepository", () => {
  describe("recordHeartbeat", () => {
    it("issues a single atomic upsert with the given values, in installation_id/receivedAt/clientReportedAt/appVersion order", async () => {
      const { repository, query } = buildRepository();
      const receivedAt = new Date("2026-01-01T00:00:00.000Z");
      const clientReportedAt = new Date("2026-01-01T00:00:00.100Z");

      await repository.recordHeartbeat({
        installationId: "installation-1",
        receivedAt,
        appVersion: "1.4.2",
        clientReportedAt,
      });

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain("INSERT INTO installations.installation_health");
      expect(sql).toContain("ON CONFLICT (installation_id) DO UPDATE SET");
      expect(params).toEqual(["installation-1", receivedAt, clientReportedAt, "1.4.2"]);
    });

    it("uses GREATEST for last_seen_at so a heartbeat can never regress it under concurrent/reordered delivery", async () => {
      const { repository, query } = buildRepository();

      await repository.recordHeartbeat({
        installationId: "installation-1",
        receivedAt: new Date(),
        appVersion: "1.4.2",
        clientReportedAt: null,
      });

      const [sql] = query.mock.calls[0];
      expect(sql).toContain(
        "last_seen_at = GREATEST(installation_health.last_seen_at, EXCLUDED.last_seen_at)",
      );
    });

    it("ties app_version and client_reported_at to the SAME winning row (newest receivedAt), never independently", async () => {
      const { repository, query } = buildRepository();

      await repository.recordHeartbeat({
        installationId: "installation-1",
        receivedAt: new Date(),
        appVersion: "1.4.2",
        clientReportedAt: null,
      });

      const [sql] = query.mock.calls[0];
      // Both columns are gated on the identical condition - a heartbeat that finishes later but was
      // sent earlier can never overwrite app_version/client_reported_at with stale data even though
      // it "arrived last" in wall-clock terms.
      const condition = "WHEN EXCLUDED.last_seen_at >= installation_health.last_seen_at";
      expect(sql.split(condition).length - 1).toBe(2);
      expect(sql).toContain("THEN EXCLUDED.app_version");
      expect(sql).toContain("THEN EXCLUDED.client_reported_at");
    });

    it("never assigns first_seen_at in the UPDATE SET clause - only the initial INSERT sets it", async () => {
      const { repository, query } = buildRepository();

      await repository.recordHeartbeat({
        installationId: "installation-1",
        receivedAt: new Date(),
        appVersion: "1.4.2",
        clientReportedAt: null,
      });

      const [sql] = query.mock.calls[0];
      const setClause = sql.slice(sql.indexOf("DO UPDATE SET"));
      expect(setClause).not.toContain("first_seen_at =");
    });
  });

  describe("findByInstallationId", () => {
    it("returns null when no health row exists yet", async () => {
      const { repository } = buildRepository(null);

      await expect(repository.findByInstallationId("installation-1")).resolves.toBeNull();
    });

    it("maps an existing row to a snapshot", async () => {
      const record = new InstallationHealthRecord();
      record.installationId = "installation-1";
      record.firstSeenAt = new Date("2026-01-01T00:00:00.000Z");
      record.lastSeenAt = new Date("2026-01-01T00:05:00.000Z");
      record.clientReportedAt = null;
      record.appVersion = "1.4.2";
      const { repository, findOne } = buildRepository(record);

      const snapshot = await repository.findByInstallationId("installation-1");

      expect(findOne).toHaveBeenCalledWith({ where: { installationId: "installation-1" } });
      expect(snapshot).toEqual({
        firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-01-01T00:05:00.000Z"),
        clientReportedAt: null,
        appVersion: "1.4.2",
      });
    });
  });
});
