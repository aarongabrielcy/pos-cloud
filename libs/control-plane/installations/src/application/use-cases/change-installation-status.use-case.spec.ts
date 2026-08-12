import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader, FakeLicenseReader } from "../../test-support/fake-readers";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationRepository } from "../../test-support/in-memory-installation-repository";
import {
  InstallationNotFoundError,
  InvalidInstallationStatusTransitionError,
} from "../../domain/installation.errors";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import { ChangeInstallationStatusUseCase } from "./change-installation-status.use-case";
import { CreateInstallationUseCase } from "./create-installation.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("ChangeInstallationStatusUseCase", () => {
  it("throws InstallationNotFoundError for a missing installation", async () => {
    const repository = new InMemoryInstallationRepository();

    await expect(
      new ChangeInstallationStatusUseCase(repository, clock).execute({
        id: randomUUID(),
        status: InstallationStatus.DECOMMISSIONED,
      }),
    ).rejects.toThrow(InstallationNotFoundError);
  });

  it("rejects PENDING -> ACTIVE - no admin activation in CLOUD-01B", async () => {
    const repository = new InMemoryInstallationRepository();
    const customerReader = new FakeCustomerReader();
    const licenseReader = new FakeLicenseReader();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });
    const created = await new CreateInstallationUseCase(
      repository,
      customerReader,
      licenseReader,
      clock,
      new RandomUuidGenerator(),
    ).execute({
      customerId,
      licenseId,
      installationCode: "POS-GST-00001",
      name: "Sucursal Principal",
      platform: Platform.WINDOWS,
    });

    await expect(
      new ChangeInstallationStatusUseCase(repository, clock).execute({
        id: created.id.toString(),
        status: InstallationStatus.ACTIVE,
      }),
    ).rejects.toThrow(InvalidInstallationStatusTransitionError);
  });

  it("allows PENDING -> DECOMMISSIONED", async () => {
    const repository = new InMemoryInstallationRepository();
    const customerReader = new FakeCustomerReader();
    const licenseReader = new FakeLicenseReader();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });
    const created = await new CreateInstallationUseCase(
      repository,
      customerReader,
      licenseReader,
      clock,
      new RandomUuidGenerator(),
    ).execute({
      customerId,
      licenseId,
      installationCode: "POS-GST-00001",
      name: "Sucursal Principal",
      platform: Platform.WINDOWS,
    });

    const updated = await new ChangeInstallationStatusUseCase(repository, clock).execute({
      id: created.id.toString(),
      status: InstallationStatus.DECOMMISSIONED,
    });

    expect(updated.status).toBe(InstallationStatus.DECOMMISSIONED);
  });
});
