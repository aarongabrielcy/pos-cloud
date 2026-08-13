import { randomUUID } from "node:crypto";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { DuplicateEntitlementCodeError, LicenseNotFoundError } from "../../domain/license.errors";
import { LICENSE_AUDIT_ACTIONS, LICENSE_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { CreateLicenseUseCase } from "./create-license.use-case";
import { ReplaceLicenseEntitlementsUseCase } from "./replace-license-entitlements.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

async function createLicense(repository: InMemoryLicenseRepository) {
  const customerReader = new FakeCustomerReader();
  const customerId = randomUUID();
  customerReader.register({ id: customerId, active: true });
  const useCase = new CreateLicenseUseCase(
    repository,
    customerReader,
    clock,
    new RandomUuidGenerator(),
    new FakeAuditRecorder(),
  );
  return useCase.execute(
    {
      customerId,
      licenseNumber: "LIC-GST-00001",
      edition: LicenseEdition.BASIC,
      licenseModel: LicenseModel.PERPETUAL,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      maxInstallations: 1,
    },
    ACTOR,
  );
}

describe("ReplaceLicenseEntitlementsUseCase", () => {
  it("throws LicenseNotFoundError for a missing license", async () => {
    const repository = new InMemoryLicenseRepository();
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
      new FakeAuditRecorder(),
    );

    await expect(
      useCase.execute({ licenseId: randomUUID(), entitlements: [] }, ACTOR),
    ).rejects.toThrow(LicenseNotFoundError);
  });

  it("replaces the entitlement collection atomically (transactionally, via the repository port)", async () => {
    const repository = new InMemoryLicenseRepository();
    const created = await createLicense(repository);
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
      new FakeAuditRecorder(),
    );

    const updated = await useCase.execute(
      {
        licenseId: created.id.toString(),
        entitlements: [
          { code: "integrated_payments", enabled: true },
          { code: "cloud_backup", enabled: false },
        ],
      },
      ACTOR,
    );

    expect(updated.entitlements).toHaveLength(2);
  });

  it("rejects duplicate entitlement codes in the same request", async () => {
    const repository = new InMemoryLicenseRepository();
    const created = await createLicense(repository);
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
      new FakeAuditRecorder(),
    );

    await expect(
      useCase.execute(
        {
          licenseId: created.id.toString(),
          entitlements: [
            { code: "integrated_payments", enabled: true },
            { code: "integrated_payments", enabled: false },
          ],
        },
        ACTOR,
      ),
    ).rejects.toThrow(DuplicateEntitlementCodeError);
  });

  it("records an audit event with the entitlement count after a successful replace", async () => {
    const repository = new InMemoryLicenseRepository();
    const created = await createLicense(repository);
    const auditRecorder = new FakeAuditRecorder();
    const useCase = new ReplaceLicenseEntitlementsUseCase(
      repository,
      new RandomUuidGenerator(),
      clock,
      auditRecorder,
    );

    await useCase.execute(
      {
        licenseId: created.id.toString(),
        entitlements: [{ code: "integrated_payments", enabled: true }],
      },
      ACTOR,
    );

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: LICENSE_AUDIT_ACTIONS.ENTITLEMENTS_REPLACED,
        resourceType: LICENSE_AUDIT_RESOURCE_TYPE,
        resourceId: created.id.toString(),
        metadata: { entitlementCount: 1 },
      },
    ]);
  });
});
