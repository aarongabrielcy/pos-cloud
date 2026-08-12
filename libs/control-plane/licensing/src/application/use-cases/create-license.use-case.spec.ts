import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import {
  CustomerNotEligibleForLicenseError,
  LicenseCustomerNotFoundError,
  LicenseNumberAlreadyExistsError,
} from "../../domain/license.errors";
import { CreateLicenseUseCase } from "./create-license.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function setup() {
  const repository = new InMemoryLicenseRepository();
  const customerReader = new FakeCustomerReader();
  const useCase = new CreateLicenseUseCase(
    repository,
    customerReader,
    clock,
    new RandomUuidGenerator(),
  );
  return { repository, customerReader, useCase };
}

const validCommand = {
  customerId: randomUUID(),
  licenseNumber: "LIC-GST-00001",
  edition: LicenseEdition.BASIC,
  licenseModel: LicenseModel.PERPETUAL,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: null,
  maxInstallations: 1,
};

describe("CreateLicenseUseCase", () => {
  it("fails when the customer does not exist", async () => {
    const { useCase } = setup();

    await expect(useCase.execute(validCommand)).rejects.toThrow(LicenseCustomerNotFoundError);
  });

  it("fails when the customer is not active (e.g. SUSPENDED)", async () => {
    const { useCase, customerReader } = setup();
    customerReader.register({ id: validCommand.customerId, active: false });

    await expect(useCase.execute(validCommand)).rejects.toThrow(CustomerNotEligibleForLicenseError);
  });

  it("creates a license for an active customer", async () => {
    const { useCase, customerReader } = setup();
    customerReader.register({ id: validCommand.customerId, active: true });

    const license = await useCase.execute(validCommand);

    expect(license.licenseNumber.toString()).toBe("LIC-GST-00001");
  });

  it("rejects a duplicate license number", async () => {
    const { useCase, customerReader } = setup();
    customerReader.register({ id: validCommand.customerId, active: true });
    await useCase.execute(validCommand);

    const otherCustomerId = randomUUID();
    customerReader.register({ id: otherCustomerId, active: true });

    await expect(useCase.execute({ ...validCommand, customerId: otherCustomerId })).rejects.toThrow(
      LicenseNumberAlreadyExistsError,
    );
  });

  it("creates a license together with its initial entitlements", async () => {
    const { useCase, customerReader } = setup();
    customerReader.register({ id: validCommand.customerId, active: true });

    const license = await useCase.execute({
      ...validCommand,
      entitlements: [{ code: "integrated_payments", enabled: true, configuration: null }],
    });

    expect(license.entitlements).toHaveLength(1);
  });
});
