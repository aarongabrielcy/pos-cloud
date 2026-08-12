import type { DataSource, EntityManager } from "typeorm";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationCredential } from "../../domain/installation-credential";
import { InstallationCredentialId } from "../../domain/installation-credential-id";
import { InstallationEnrollment } from "../../domain/installation-enrollment";
import { InstallationEnrollmentId } from "../../domain/installation-enrollment-id";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { InstallationCredentialRecord } from "./installation-credential.record";
import { InstallationEnrollmentRecord } from "./installation-enrollment.record";
import { InstallationRecord } from "./installation.record";
import { TypeOrmInstallationEnrollmentConsumptionUnitOfWork } from "./typeorm-installation-enrollment-consumption-unit-of-work";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

function buildFakeManager() {
  const getOne = jest.fn().mockResolvedValue(null);
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

describe("TypeOrmInstallationEnrollmentConsumptionUnitOfWork", () => {
  it("locks the Installation row before the enrollment row (Installation-first lock order)", async () => {
    const { manager, createQueryBuilder, setLock } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );
    const callOrder: string[] = [];
    createQueryBuilder.mockImplementation((entity: { name: string }) => {
      callOrder.push(entity.name);
      return { setLock };
    });

    await unitOfWork.runExclusive("installation-1", async (ctx) => {
      await ctx.findInstallationForUpdate("installation-1");
      await ctx.findEnrollmentForUpdate("enrollment-1");
    });

    expect(callOrder).toEqual(["InstallationRecord", "InstallationEnrollmentRecord"]);
  });

  it("findInstallationForUpdate uses pessimistic_write", async () => {
    const { manager, setLock } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );

    await unitOfWork.runExclusive("installation-1", (ctx) =>
      ctx.findInstallationForUpdate("installation-1"),
    );

    expect(setLock).toHaveBeenCalledWith("pessimistic_write");
  });

  it("findEnrollmentForUpdate uses pessimistic_write", async () => {
    const { manager, setLock } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );

    await unitOfWork.runExclusive("installation-1", (ctx) =>
      ctx.findEnrollmentForUpdate("enrollment-1"),
    );

    expect(setLock).toHaveBeenCalledWith("pessimistic_write");
  });

  it("saveInstallation persists via manager.save with the mapped record", async () => {
    const { manager, save } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );
    const installation = Installation.reconstitute({
      id: InstallationId.of("installation-1"),
      customerId: "customer-1",
      licenseId: "license-1",
      installationCode: InstallationCode.create("POS-GST-00001"),
      name: "Sucursal Principal",
      platform: Platform.WINDOWS,
      status: InstallationStatus.ACTIVE,
      registeredAt: BASE_TIME,
      createdAt: BASE_TIME,
      updatedAt: BASE_TIME,
    });

    await unitOfWork.runExclusive("installation-1", (ctx) => ctx.saveInstallation(installation));

    expect(save).toHaveBeenCalledWith(
      InstallationRecord,
      expect.objectContaining({ id: "installation-1", status: InstallationStatus.ACTIVE }),
    );
  });

  it("saveEnrollment persists via manager.save with the mapped record", async () => {
    const { manager, save } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );
    const enrollment = InstallationEnrollment.reconstitute({
      id: InstallationEnrollmentId.of("enrollment-1"),
      installationId: "installation-1",
      purpose: InstallationEnrollmentPurpose.INITIAL,
      codeHash: "a".repeat(64),
      createdAt: BASE_TIME,
      expiresAt: new Date(BASE_TIME.getTime() + 900_000),
      consumedAt: BASE_TIME,
      revokedAt: null,
    });

    await unitOfWork.runExclusive("installation-1", (ctx) => ctx.saveEnrollment(enrollment));

    expect(save).toHaveBeenCalledWith(
      InstallationEnrollmentRecord,
      expect.objectContaining({ id: "enrollment-1", consumedAt: BASE_TIME }),
    );
  });

  it("findActiveCredentialByInstallationId queries with revokedAt null", async () => {
    const { manager, findOne } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );

    await unitOfWork.runExclusive("installation-1", (ctx) =>
      ctx.findActiveCredentialByInstallationId("installation-1"),
    );

    expect(findOne).toHaveBeenCalledWith(
      InstallationCredentialRecord,
      expect.objectContaining({
        where: expect.objectContaining({ installationId: "installation-1" }),
      }),
    );
  });

  it("saveCredential persists via manager.save with the mapped record", async () => {
    const { manager, save } = buildFakeManager();
    const unitOfWork = new TypeOrmInstallationEnrollmentConsumptionUnitOfWork(
      buildDataSource(manager),
    );
    const credential = InstallationCredential.reconstitute({
      id: InstallationCredentialId.of("credential-1"),
      installationId: "installation-1",
      secretHash: "b".repeat(64),
      createdAt: BASE_TIME,
      revokedAt: null,
    });

    await unitOfWork.runExclusive("installation-1", (ctx) => ctx.saveCredential(credential));

    expect(save).toHaveBeenCalledWith(
      InstallationCredentialRecord,
      expect.objectContaining({ id: "credential-1" }),
    );
  });
});
