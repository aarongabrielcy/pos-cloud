import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader, FakeLicenseReader } from "../../test-support/fake-readers";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryInstallationRepository } from "../../test-support/in-memory-installation-repository";
import {
  InstallationCodeAlreadyExistsError,
  InstallationCustomerNotActiveError,
  InstallationCustomerNotFoundError,
  InstallationLicenseNotFoundError,
  LicenseCapacityExceededError,
  LicenseCustomerMismatchError,
  LicenseNotUsableError,
} from "../../domain/installation.errors";
import { Platform } from "../../domain/platform";
import { CreateInstallationUseCase } from "./create-installation.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function setup() {
  const repository = new InMemoryInstallationRepository();
  const customerReader = new FakeCustomerReader();
  const licenseReader = new FakeLicenseReader();
  const useCase = new CreateInstallationUseCase(
    repository,
    customerReader,
    licenseReader,
    clock,
    new RandomUuidGenerator(),
  );
  return { repository, customerReader, licenseReader, useCase };
}

function baseCommand(overrides: { customerId: string; licenseId: string }) {
  return {
    customerId: overrides.customerId,
    licenseId: overrides.licenseId,
    installationCode: "POS-GST-00001",
    name: "Sucursal Principal",
    platform: Platform.WINDOWS,
  };
}

describe("CreateInstallationUseCase", () => {
  it("fails when the customer does not exist", async () => {
    const { useCase } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();

    await expect(useCase.execute(baseCommand({ customerId, licenseId }))).rejects.toThrow(
      InstallationCustomerNotFoundError,
    );
  });

  it("fails when the customer is not active", async () => {
    const { useCase, customerReader } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: false });

    await expect(useCase.execute(baseCommand({ customerId, licenseId }))).rejects.toThrow(
      InstallationCustomerNotActiveError,
    );
  });

  it("fails when the license does not exist", async () => {
    const { useCase, customerReader } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });

    await expect(useCase.execute(baseCommand({ customerId, licenseId }))).rejects.toThrow(
      InstallationLicenseNotFoundError,
    );
  });

  it("fails when the license belongs to a different customer", async () => {
    const { useCase, customerReader, licenseReader } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({
      id: licenseId,
      customerId: randomUUID(),
      maxInstallations: 5,
      usable: true,
    });

    await expect(useCase.execute(baseCommand({ customerId, licenseId }))).rejects.toThrow(
      LicenseCustomerMismatchError,
    );
  });

  it("fails when the license is not usable", async () => {
    const { useCase, customerReader, licenseReader } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: false });

    await expect(useCase.execute(baseCommand({ customerId, licenseId }))).rejects.toThrow(
      LicenseNotUsableError,
    );
  });

  it("fails when license capacity is already exhausted", async () => {
    const { useCase, customerReader, licenseReader, repository } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 1, usable: true });
    await useCase.execute(baseCommand({ customerId, licenseId }));
    expect(await repository.countNonDecommissionedByLicense(licenseId)).toBe(1);

    await expect(
      useCase.execute({
        ...baseCommand({ customerId, licenseId }),
        installationCode: "POS-GST-00002",
      }),
    ).rejects.toThrow(LicenseCapacityExceededError);
  });

  it("succeeds and starts PENDING when capacity is available", async () => {
    const { useCase, customerReader, licenseReader } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 2, usable: true });

    const installation = await useCase.execute(baseCommand({ customerId, licenseId }));

    expect(installation.status).toBe("PENDING");
    expect(installation.registeredAt).toBeNull();
  });

  it("rejects a duplicate installationCode", async () => {
    const { useCase, customerReader, licenseReader } = setup();
    const customerId = randomUUID();
    const licenseId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    licenseReader.register({ id: licenseId, customerId, maxInstallations: 5, usable: true });
    await useCase.execute(baseCommand({ customerId, licenseId }));

    await expect(useCase.execute(baseCommand({ customerId, licenseId }))).rejects.toThrow(
      InstallationCodeAlreadyExistsError,
    );
  });
});
