import { randomUUID } from "node:crypto";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FakeCustomerReader, FakeLicenseReader } from "../../test-support/fake-readers";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationRepository } from "../../test-support/in-memory-installation-repository";
import {
  InstallationNotFoundError,
  InvalidInstallationStatusTransitionError,
} from "../../domain/installation.errors";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { ChangeInstallationStatusUseCase } from "./change-installation-status.use-case";
import { CreateInstallationUseCase } from "./create-installation.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

async function createInstallation(repository: InMemoryInstallationRepository) {
  const customerReader = new FakeCustomerReader();
  const licenseReader = new FakeLicenseReader();
  const customerId = randomUUID();
  const licenseId = randomUUID();
  customerReader.register({ id: customerId, active: true });
  licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });
  return new CreateInstallationUseCase(
    repository,
    customerReader,
    licenseReader,
    clock,
    new RandomUuidGenerator(),
    new FakeAuditRecorder(),
  ).execute(
    {
      customerId,
      licenseId,
      installationCode: "POS-GST-00001",
      name: "Sucursal Principal",
      platform: Platform.WINDOWS,
    },
    ACTOR,
  );
}

describe("ChangeInstallationStatusUseCase", () => {
  it("throws InstallationNotFoundError for a missing installation", async () => {
    const repository = new InMemoryInstallationRepository();

    await expect(
      new ChangeInstallationStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
        { id: randomUUID(), status: InstallationStatus.DECOMMISSIONED },
        ACTOR,
      ),
    ).rejects.toThrow(InstallationNotFoundError);
  });

  it("rejects PENDING -> ACTIVE - no admin activation in CLOUD-01B", async () => {
    const repository = new InMemoryInstallationRepository();
    const created = await createInstallation(repository);

    await expect(
      new ChangeInstallationStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
        { id: created.id.toString(), status: InstallationStatus.ACTIVE },
        ACTOR,
      ),
    ).rejects.toThrow(InvalidInstallationStatusTransitionError);
  });

  it("allows PENDING -> DECOMMISSIONED", async () => {
    const repository = new InMemoryInstallationRepository();
    const created = await createInstallation(repository);

    const updated = await new ChangeInstallationStatusUseCase(
      repository,
      clock,
      new FakeAuditRecorder(),
    ).execute({ id: created.id.toString(), status: InstallationStatus.DECOMMISSIONED }, ACTOR);

    expect(updated.status).toBe(InstallationStatus.DECOMMISSIONED);
  });

  it("records an audit event with from/to metadata after a successful status change", async () => {
    const repository = new InMemoryInstallationRepository();
    const created = await createInstallation(repository);
    const auditRecorder = new FakeAuditRecorder();

    await new ChangeInstallationStatusUseCase(repository, clock, auditRecorder).execute(
      { id: created.id.toString(), status: InstallationStatus.DECOMMISSIONED },
      ACTOR,
    );

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: INSTALLATION_AUDIT_ACTIONS.STATUS_CHANGED,
        resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
        resourceId: created.id.toString(),
        metadata: { from: InstallationStatus.PENDING, to: InstallationStatus.DECOMMISSIONED },
      },
    ]);
  });
});
