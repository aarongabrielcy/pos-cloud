import type { DataSource, EntityManager } from "typeorm";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { InstallationRecord } from "./installation.record";
import { TypeOrmInstallationCreationUnitOfWork } from "./typeorm-installation-creation-unit-of-work";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

function buildFakeManager() {
  const query = jest.fn().mockResolvedValue(undefined);
  const count = jest.fn().mockResolvedValue(0);
  const findOne = jest.fn().mockResolvedValue(null);
  const save = jest.fn().mockResolvedValue(undefined);

  const manager = { query, count, findOne, save } as unknown as EntityManager;
  return { manager, query, count, findOne, save };
}

function buildDataSource(manager: EntityManager): DataSource {
  return {
    transaction: async <T>(fn: (m: EntityManager) => Promise<T>): Promise<T> => fn(manager),
  } as unknown as DataSource;
}

function buildInstallation(): Installation {
  return Installation.reconstitute({
    id: InstallationId.of("installation-1"),
    customerId: "customer-1",
    licenseId: "license-1",
    installationCode: InstallationCode.create("POS-GST-00001"),
    name: "Sucursal Principal",
    platform: Platform.WINDOWS,
    status: InstallationStatus.PENDING,
    registeredAt: null,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

describe("TypeOrmInstallationCreationUnitOfWork", () => {
  it("acquires the per-license Postgres advisory lock before anything else", async () => {
    const { manager, query, count } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationCreationUnitOfWork(buildDataSource(manager));

    await unitOfWork.runExclusiveForLicense("license-1", async (ctx) => {
      await ctx.countNonDecommissionedByLicense("license-1");
    });

    expect(query).toHaveBeenCalledWith("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
      "license-1",
    ]);
    // The lock call is the FIRST thing this unit of work does inside the transaction.
    expect(query.mock.invocationCallOrder[0]).toBeLessThan(count.mock.invocationCallOrder[0]);
  });

  it("countNonDecommissionedByLicense counts via manager.count excluding DECOMMISSIONED", async () => {
    const { manager, count } = buildFakeManager();
    count.mockResolvedValue(3);
    const unitOfWork = new TypeOrmInstallationCreationUnitOfWork(buildDataSource(manager));

    const result = await unitOfWork.runExclusiveForLicense("license-1", (ctx) =>
      ctx.countNonDecommissionedByLicense("license-1"),
    );

    expect(result).toBe(3);
    expect(count).toHaveBeenCalledWith(
      InstallationRecord,
      expect.objectContaining({ where: expect.objectContaining({ licenseId: "license-1" }) }),
    );
  });

  it("findInstallationByCode queries by installationCode and maps a found record", async () => {
    const { manager, findOne } = buildFakeManager();
    const record = new InstallationRecord();
    record.id = "installation-1";
    record.customerId = "customer-1";
    record.licenseId = "license-1";
    record.installationCode = "POS-GST-00001";
    record.name = "Sucursal Principal";
    record.platform = Platform.WINDOWS;
    record.status = InstallationStatus.PENDING;
    record.registeredAt = null;
    record.createdAt = BASE_TIME;
    record.updatedAt = BASE_TIME;
    findOne.mockResolvedValue(record);
    const unitOfWork = new TypeOrmInstallationCreationUnitOfWork(buildDataSource(manager));

    const result = await unitOfWork.runExclusiveForLicense("license-1", (ctx) =>
      ctx.findInstallationByCode(InstallationCode.create("POS-GST-00001")),
    );

    expect(findOne).toHaveBeenCalledWith(
      InstallationRecord,
      expect.objectContaining({
        where: expect.objectContaining({ installationCode: "POS-GST-00001" }),
      }),
    );
    expect(result?.installationCode.toString()).toBe("POS-GST-00001");
  });

  it("saveInstallation persists via manager.save with the mapped record", async () => {
    const { manager, save } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationCreationUnitOfWork(buildDataSource(manager));
    const installation = buildInstallation();

    await unitOfWork.runExclusiveForLicense("license-1", (ctx) =>
      ctx.saveInstallation(installation),
    );

    expect(save).toHaveBeenCalledWith(
      InstallationRecord,
      expect.objectContaining({ id: "installation-1", licenseId: "license-1" }),
    );
  });

  it("translates a unique-violation on save into InstallationCodeAlreadyExistsError", async () => {
    const { manager, save } = buildFakeManager();
    save.mockRejectedValue({ code: "23505" });
    const unitOfWork = new TypeOrmInstallationCreationUnitOfWork(buildDataSource(manager));
    const installation = buildInstallation();

    await expect(
      unitOfWork.runExclusiveForLicense("license-1", (ctx) => ctx.saveInstallation(installation)),
    ).rejects.toThrow("Installation code already exists: POS-GST-00001");
  });
});
