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
import { GetLicenseSummaryUseCase } from "./get-license-summary.use-case";

const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

describe("GetLicenseSummaryUseCase", () => {
  it("returns null for a missing license", async () => {
    const repository = new InMemoryLicenseRepository();
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

    const summary = await new GetLicenseSummaryUseCase(repository, clock).execute(randomUUID());

    expect(summary).toBeNull();
  });

  it("computes `usable` from License.isUsable rather than exposing raw status/dates", async () => {
    const repository = new InMemoryLicenseRepository();
    const creationClock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const customerReader = new FakeCustomerReader();
    const customerId = randomUUID();
    customerReader.register({ id: customerId, active: true });

    const license = await new CreateLicenseUseCase(
      repository,
      customerReader,
      creationClock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    ).execute(
      {
        customerId,
        licenseNumber: "LIC-GST-00001",
        edition: LicenseEdition.PREMIUM,
        licenseModel: LicenseModel.SUBSCRIPTION,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2027-01-01T00:00:00.000Z"),
        maxInstallations: 3,
      },
      ACTOR,
    );

    const afterExpiry = new FixedClock(new Date("2027-06-01T00:00:00.000Z"));
    const summary = await new GetLicenseSummaryUseCase(repository, afterExpiry).execute(
      license.id.toString(),
    );

    expect(summary).toEqual({
      id: license.id.toString(),
      customerId,
      maxInstallations: 3,
      usable: false,
    });
  });
});
