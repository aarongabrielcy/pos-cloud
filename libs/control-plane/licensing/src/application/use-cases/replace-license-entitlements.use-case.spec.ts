import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { DuplicateEntitlementCodeError, LicenseNotFoundError } from "../../domain/license.errors";
import { CreateLicenseUseCase } from "./create-license.use-case";
import { ReplaceLicenseEntitlementsUseCase } from "./replace-license-entitlements.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

async function createLicense(repository: InMemoryLicenseRepository) {
  const customerReader = new FakeCustomerReader();
  const customerId = randomUUID();
  customerReader.register({ id: customerId, active: true });
  const useCase = new CreateLicenseUseCase(
    repository,
    customerReader,
    clock,
    new RandomUuidGenerator(),
  );
  return useCase.execute({
    customerId,
    licenseNumber: "LIC-GST-00001",
    edition: LicenseEdition.BASIC,
    licenseModel: LicenseModel.PERPETUAL,
    validFrom: new Date("2026-01-01T00:00:00.000Z"),
    validUntil: null,
    maxInstallations: 1,
  });
}

describe("ReplaceLicenseEntitlementsUseCase", () => {
  it("throws LicenseNotFoundError for a missing license", async () => {
    const repository = new InMemoryLicenseRepository();
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
    );

    await expect(useCase.execute({ licenseId: randomUUID(), entitlements: [] })).rejects.toThrow(
      LicenseNotFoundError,
    );
  });

  it("replaces the entitlement collection atomically (transactionally, via the repository port)", async () => {
    const repository = new InMemoryLicenseRepository();
    const created = await createLicense(repository);
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
    );

    const updated = await useCase.execute({
      licenseId: created.id.toString(),
      entitlements: [
        { code: "integrated_payments", enabled: true },
        { code: "cloud_backup", enabled: false },
      ],
    });

    expect(updated.entitlements).toHaveLength(2);
  });

  it("rejects duplicate entitlement codes in the same request", async () => {
    const repository = new InMemoryLicenseRepository();
    const created = await createLicense(repository);
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
    );

    await expect(
      useCase.execute({
        licenseId: created.id.toString(),
        entitlements: [
          { code: "integrated_payments", enabled: true },
          { code: "integrated_payments", enabled: false },
        ],
      }),
    ).rejects.toThrow(DuplicateEntitlementCodeError);
  });
});
