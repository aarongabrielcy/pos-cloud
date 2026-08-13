import { randomUUID } from "node:crypto";
import type { InstallationAuthConfig } from "@pos-cloud/config";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import type { InstallationEnrollment } from "../../domain/installation-enrollment";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationId } from "../../domain/installation-id";
import { InstallationStatus } from "../../domain/installation-status";
import {
  InstallationNotEligibleForEnrollmentError,
  InstallationNotFoundError,
} from "../../domain/installation.errors";
import { Platform } from "../../domain/platform";
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FakeInstallationSecretGenerator } from "../../test-support/fake-installation-secret-generator";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationEnrollmentIssuanceUnitOfWork } from "../../test-support/in-memory-installation-enrollment-issuance-unit-of-work";
import { IssueInstallationEnrollmentUseCase } from "./issue-installation-enrollment.use-case";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

function buildInstallation(status: InstallationStatus): Installation {
  const installation = Installation.reconstitute({
    id: InstallationId.of(randomUUID()),
    customerId: randomUUID(),
    licenseId: randomUUID(),
    installationCode: InstallationCode.create("POS-GST-00001"),
    name: "Sucursal Principal",
    platform: Platform.WINDOWS,
    status,
    registeredAt: status === InstallationStatus.PENDING ? null : BASE_TIME,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
  return installation;
}

function setup(ttlSeconds = 900) {
  const installations = new Map<string, Installation>();
  const enrollments = new Map<string, InstallationEnrollment>();
  const unitOfWork = new InMemoryInstallationEnrollmentIssuanceUnitOfWork(
    installations,
    enrollments,
  );
  const secretGenerator = new FakeInstallationSecretGenerator();
  const clock = new FixedClock(BASE_TIME);
  const installationAuthConfig: InstallationAuthConfig = { enrollmentCodeTtlSeconds: ttlSeconds };
  const auditRecorder = new FakeAuditRecorder();
  const useCase = new IssueInstallationEnrollmentUseCase(
    unitOfWork,
    secretGenerator,
    clock,
    new RandomUuidGenerator(),
    installationAuthConfig,
    auditRecorder,
  );
  return { installations, enrollments, useCase, secretGenerator, auditRecorder };
}

describe("IssueInstallationEnrollmentUseCase", () => {
  it("fails when the installation does not exist", async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute(
        { installationId: randomUUID(), purpose: InstallationEnrollmentPurpose.INITIAL },
        ACTOR,
      ),
    ).rejects.toThrow(InstallationNotFoundError);
  });

  it("INITIAL succeeds for a PENDING installation", async () => {
    const { installations, useCase, enrollments } = setup();
    const installation = buildInstallation(InstallationStatus.PENDING);
    installations.set(installation.id.toString(), installation);

    const result = await useCase.execute(
      {
        installationId: installation.id.toString(),
        purpose: InstallationEnrollmentPurpose.INITIAL,
      },
      ACTOR,
    );

    expect(result.installationId).toBe(installation.id.toString());
    expect(result.enrollmentCode).toContain(".");
    expect(enrollments.size).toBe(1);
    const [stored] = [...enrollments.values()];
    expect(stored.purpose).toBe(InstallationEnrollmentPurpose.INITIAL);
    expect(stored.isConsumable(BASE_TIME)).toBe(true);
  });

  it("records an audit event with purpose metadata after a successful issuance", async () => {
    const { installations, useCase, auditRecorder } = setup();
    const installation = buildInstallation(InstallationStatus.PENDING);
    installations.set(installation.id.toString(), installation);

    await useCase.execute(
      {
        installationId: installation.id.toString(),
        purpose: InstallationEnrollmentPurpose.INITIAL,
      },
      ACTOR,
    );

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: INSTALLATION_AUDIT_ACTIONS.ENROLLMENT_ISSUED,
        resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
        resourceId: installation.id.toString(),
        metadata: { purpose: InstallationEnrollmentPurpose.INITIAL },
      },
    ]);
  });

  it("does not record an audit event when issuance fails", async () => {
    const { installations, useCase, auditRecorder } = setup();
    const installation = buildInstallation(InstallationStatus.ACTIVE);
    installations.set(installation.id.toString(), installation);

    await expect(
      useCase.execute(
        {
          installationId: installation.id.toString(),
          purpose: InstallationEnrollmentPurpose.INITIAL,
        },
        ACTOR,
      ),
    ).rejects.toThrow(InstallationNotEligibleForEnrollmentError);
    expect(auditRecorder.recorded).toHaveLength(0);
  });

  it("INITIAL rejects an ACTIVE installation", async () => {
    const { installations, useCase } = setup();
    const installation = buildInstallation(InstallationStatus.ACTIVE);
    installations.set(installation.id.toString(), installation);

    await expect(
      useCase.execute(
        {
          installationId: installation.id.toString(),
          purpose: InstallationEnrollmentPurpose.INITIAL,
        },
        ACTOR,
      ),
    ).rejects.toThrow(InstallationNotEligibleForEnrollmentError);
  });

  it("RECOVERY succeeds for an ACTIVE installation", async () => {
    const { installations, useCase } = setup();
    const installation = buildInstallation(InstallationStatus.ACTIVE);
    installations.set(installation.id.toString(), installation);

    const result = await useCase.execute(
      {
        installationId: installation.id.toString(),
        purpose: InstallationEnrollmentPurpose.RECOVERY,
      },
      ACTOR,
    );

    expect(result.enrollmentCode).toContain(".");
  });

  it("RECOVERY succeeds for a SUSPENDED installation", async () => {
    const { installations, useCase } = setup();
    const installation = buildInstallation(InstallationStatus.SUSPENDED);
    installations.set(installation.id.toString(), installation);

    await expect(
      useCase.execute(
        {
          installationId: installation.id.toString(),
          purpose: InstallationEnrollmentPurpose.RECOVERY,
        },
        ACTOR,
      ),
    ).resolves.toBeDefined();
  });

  it("RECOVERY rejects a PENDING installation", async () => {
    const { installations, useCase } = setup();
    const installation = buildInstallation(InstallationStatus.PENDING);
    installations.set(installation.id.toString(), installation);

    await expect(
      useCase.execute(
        {
          installationId: installation.id.toString(),
          purpose: InstallationEnrollmentPurpose.RECOVERY,
        },
        ACTOR,
      ),
    ).rejects.toThrow(InstallationNotEligibleForEnrollmentError);
  });

  it("RECOVERY rejects a DECOMMISSIONED installation", async () => {
    const { installations, useCase } = setup();
    const installation = buildInstallation(InstallationStatus.DECOMMISSIONED);
    installations.set(installation.id.toString(), installation);

    await expect(
      useCase.execute(
        {
          installationId: installation.id.toString(),
          purpose: InstallationEnrollmentPurpose.RECOVERY,
        },
        ACTOR,
      ),
    ).rejects.toThrow(InstallationNotEligibleForEnrollmentError);
  });

  it("revokes a prior still-open enrollment when issuing a new one (regenerate)", async () => {
    const { installations, useCase, enrollments } = setup();
    const installation = buildInstallation(InstallationStatus.PENDING);
    installations.set(installation.id.toString(), installation);

    const first = await useCase.execute(
      {
        installationId: installation.id.toString(),
        purpose: InstallationEnrollmentPurpose.INITIAL,
      },
      ACTOR,
    );
    const second = await useCase.execute(
      {
        installationId: installation.id.toString(),
        purpose: InstallationEnrollmentPurpose.INITIAL,
      },
      ACTOR,
    );

    expect(first.enrollmentCode).not.toBe(second.enrollmentCode);
    expect(enrollments.size).toBe(2);

    const firstEnrollmentId = first.enrollmentCode.split(".")[0];
    const firstStored = enrollments.get(firstEnrollmentId!);
    expect(firstStored?.isRevoked()).toBe(true);

    const secondEnrollmentId = second.enrollmentCode.split(".")[0];
    const secondStored = enrollments.get(secondEnrollmentId!);
    expect(secondStored?.isConsumable(BASE_TIME)).toBe(true);
  });

  it("sets expiresAt from InstallationAuthConfig.enrollmentCodeTtlSeconds", async () => {
    const { installations, useCase } = setup(60);
    const installation = buildInstallation(InstallationStatus.PENDING);
    installations.set(installation.id.toString(), installation);

    const result = await useCase.execute(
      {
        installationId: installation.id.toString(),
        purpose: InstallationEnrollmentPurpose.INITIAL,
      },
      ACTOR,
    );

    expect(result.expiresAt.getTime() - BASE_TIME.getTime()).toBe(60_000);
  });
});
