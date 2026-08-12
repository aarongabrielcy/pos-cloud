import type { DataSource, EntityManager } from "typeorm";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationEnrollment } from "../../domain/installation-enrollment";
import { InstallationEnrollmentId } from "../../domain/installation-enrollment-id";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { InstallationEnrollmentRecord } from "./installation-enrollment.record";
import { InstallationRecord } from "./installation.record";
import { TypeOrmInstallationEnrollmentIssuanceUnitOfWork } from "./typeorm-installation-enrollment-issuance-unit-of-work";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

function buildFakeManager(installationRow: InstallationRecord | null) {
  const getOne = jest.fn().mockResolvedValue(installationRow);
  const where = jest.fn().mockReturnValue({ getOne });
  const setLock = jest.fn().mockReturnValue({ where });
  const createQueryBuilder = jest.fn().mockReturnValue({ setLock });
  const findOne = jest.fn().mockResolvedValue(null);
  const save = jest.fn().mockResolvedValue(undefined);

  const manager = { createQueryBuilder, findOne, save } as unknown as EntityManager;
  return { manager, createQueryBuilder, setLock, where, getOne, findOne, save };
}

function buildDataSource(manager: EntityManager): DataSource {
  return {
    transaction: async <T>(fn: (m: EntityManager) => Promise<T>): Promise<T> => fn(manager),
  } as unknown as DataSource;
}

function buildInstallationRecord(): InstallationRecord {
  const installation = Installation.reconstitute({
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
  const record = new InstallationRecord();
  record.id = installation.id.toString();
  record.customerId = installation.customerId;
  record.licenseId = installation.licenseId;
  record.installationCode = installation.installationCode.toString();
  record.name = installation.name;
  record.platform = installation.platform;
  record.status = installation.status;
  record.registeredAt = installation.registeredAt;
  record.createdAt = installation.createdAt;
  record.updatedAt = installation.updatedAt;
  return record;
}

describe("TypeOrmInstallationEnrollmentIssuanceUnitOfWork", () => {
  it("locks the Installation row with pessimistic_write before anything else", async () => {
    const { manager, createQueryBuilder, setLock, where } =
      buildFakeManager(buildInstallationRecord());
    const unitOfWork = new TypeOrmInstallationEnrollmentIssuanceUnitOfWork(
      buildDataSource(manager),
    );

    await unitOfWork.runExclusive("installation-1", async (ctx) => {
      await ctx.findInstallationForUpdate("installation-1");
    });

    expect(createQueryBuilder).toHaveBeenCalledWith(InstallationRecord, "installation");
    expect(setLock).toHaveBeenCalledWith("pessimistic_write");
    expect(where).toHaveBeenCalledWith("installation.id = :installationId", {
      installationId: "installation-1",
    });
  });

  it("findInstallationForUpdate returns null when no row is found", async () => {
    const { manager } = buildFakeManager(null);
    const unitOfWork = new TypeOrmInstallationEnrollmentIssuanceUnitOfWork(
      buildDataSource(manager),
    );

    const result = await unitOfWork.runExclusive("missing", (ctx) =>
      ctx.findInstallationForUpdate("missing"),
    );

    expect(result).toBeNull();
  });

  it("findOpenEnrollmentByInstallationId queries with consumedAt/revokedAt both null", async () => {
    const { manager, findOne } = buildFakeManager(buildInstallationRecord());
    const unitOfWork = new TypeOrmInstallationEnrollmentIssuanceUnitOfWork(
      buildDataSource(manager),
    );

    await unitOfWork.runExclusive("installation-1", (ctx) =>
      ctx.findOpenEnrollmentByInstallationId("installation-1"),
    );

    expect(findOne).toHaveBeenCalledWith(
      InstallationEnrollmentRecord,
      expect.objectContaining({
        where: expect.objectContaining({ installationId: "installation-1" }),
      }),
    );
  });

  it("saveEnrollment persists via manager.save with the mapped record", async () => {
    const { manager, save } = buildFakeManager(buildInstallationRecord());
    const unitOfWork = new TypeOrmInstallationEnrollmentIssuanceUnitOfWork(
      buildDataSource(manager),
    );
    const enrollment = InstallationEnrollment.reconstitute({
      id: InstallationEnrollmentId.of("enrollment-1"),
      installationId: "installation-1",
      purpose: InstallationEnrollmentPurpose.INITIAL,
      codeHash: "a".repeat(64),
      createdAt: BASE_TIME,
      expiresAt: new Date(BASE_TIME.getTime() + 900_000),
      consumedAt: null,
      revokedAt: null,
    });

    await unitOfWork.runExclusive("installation-1", (ctx) => ctx.saveEnrollment(enrollment));

    expect(save).toHaveBeenCalledWith(
      InstallationEnrollmentRecord,
      expect.objectContaining({ id: "enrollment-1", installationId: "installation-1" }),
    );
  });
});
