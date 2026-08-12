import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { CreateLicenseUseCase } from "./create-license.use-case";
import { ListLicensesUseCase } from "./list-licenses.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("ListLicensesUseCase", () => {
  it("honors the pagination contract and filters by customerId", async () => {
    const repository = new InMemoryLicenseRepository();
    const customerReader = new FakeCustomerReader();
    const customerA = randomUUID();
    const customerB = randomUUID();
    customerReader.register({ id: customerA, active: true });
    customerReader.register({ id: customerB, active: true });
    const createUseCase = new CreateLicenseUseCase(
      repository,
      customerReader,
      clock,
      new RandomUuidGenerator(),
    );
    await createUseCase.execute({
      customerId: customerA,
      licenseNumber: "LIC-A-00001",
      edition: LicenseEdition.BASIC,
      licenseModel: LicenseModel.PERPETUAL,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      maxInstallations: 1,
    });
    await createUseCase.execute({
      customerId: customerB,
      licenseNumber: "LIC-B-00001",
      edition: LicenseEdition.BASIC,
      licenseModel: LicenseModel.PERPETUAL,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      maxInstallations: 1,
    });

    const result = await new ListLicensesUseCase(repository).execute({ customerId: customerA });

    expect(result).toMatchObject({ page: 1, pageSize: 25, total: 1 });
    expect(result.items[0]?.customerId).toBe(customerA);
  });
});
