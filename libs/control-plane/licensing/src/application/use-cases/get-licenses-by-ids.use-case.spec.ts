import { randomUUID } from "node:crypto";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { CreateLicenseUseCase } from "./create-license.use-case";
import { GetLicensesByIdsUseCase } from "./get-licenses-by-ids.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

describe("GetLicensesByIdsUseCase", () => {
  it("returns all matching licenses for a batch of ids in one call", async () => {
    const repository = new InMemoryLicenseRepository();
    const customerReader = new FakeCustomerReader();
    const customerId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    const createUseCase = new CreateLicenseUseCase(
      repository,
      customerReader,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    );
    const a = await createUseCase.execute(
      {
        customerId,
        licenseNumber: "LIC-GST-00001",
        edition: LicenseEdition.BASIC,
        licenseModel: LicenseModel.PERPETUAL,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        maxInstallations: 5,
      },
      ACTOR,
    );
    const b = await createUseCase.execute(
      {
        customerId,
        licenseNumber: "LIC-GST-00002",
        edition: LicenseEdition.BASIC,
        licenseModel: LicenseModel.PERPETUAL,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        maxInstallations: 5,
      },
      ACTOR,
    );

    const found = await new GetLicensesByIdsUseCase(repository).execute([
      a.id.toString(),
      b.id.toString(),
    ]);

    expect(found).toHaveLength(2);
  });

  it("returns an empty array for an empty id list without querying the repository", async () => {
    const repository = new InMemoryLicenseRepository();
    const findByIdsSpy = jest.spyOn(repository, "findByIds");

    const found = await new GetLicensesByIdsUseCase(repository).execute([]);

    expect(found).toEqual([]);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });
});
