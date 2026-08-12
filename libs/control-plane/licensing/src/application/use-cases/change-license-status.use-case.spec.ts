import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { LicenseStatus } from "../../domain/license-status";
import { LicenseNotFoundError } from "../../domain/license.errors";
import { ChangeLicenseStatusUseCase } from "./change-license-status.use-case";
import { CreateLicenseUseCase } from "./create-license.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("ChangeLicenseStatusUseCase", () => {
  it("throws LicenseNotFoundError for a missing license", async () => {
    const repository = new InMemoryLicenseRepository();

    await expect(
      new ChangeLicenseStatusUseCase(repository, clock).execute({
        id: randomUUID(),
        status: LicenseStatus.REVOKED,
      }),
    ).rejects.toThrow(LicenseNotFoundError);
  });

  it("changes status for an existing license", async () => {
    const repository = new InMemoryLicenseRepository();
    const customerReader = new FakeCustomerReader();
    const customerId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    const created = await new CreateLicenseUseCase(
      repository,
      customerReader,
      clock,
      new RandomUuidGenerator(),
    ).execute({
      customerId,
      licenseNumber: "LIC-GST-00001",
      edition: LicenseEdition.BASIC,
      licenseModel: LicenseModel.PERPETUAL,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      maxInstallations: 1,
    });

    const updated = await new ChangeLicenseStatusUseCase(repository, clock).execute({
      id: created.id.toString(),
      status: LicenseStatus.SUSPENDED,
    });

    expect(updated.status).toBe(LicenseStatus.SUSPENDED);
  });
});
