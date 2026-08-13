import { randomUUID } from "node:crypto";
import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FakeCustomerReader } from "../../test-support/fake-customer-reader";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryLicenseRepository } from "../../test-support/in-memory-license-repository";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { LicenseStatus } from "../../domain/license-status";
import { LicenseNotFoundError } from "../../domain/license.errors";
import { LICENSE_AUDIT_ACTIONS, LICENSE_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { ChangeLicenseStatusUseCase } from "./change-license-status.use-case";
import { CreateLicenseUseCase } from "./create-license.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

describe("ChangeLicenseStatusUseCase", () => {
  it("throws LicenseNotFoundError for a missing license", async () => {
    const repository = new InMemoryLicenseRepository();

    await expect(
      new ChangeLicenseStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
        { id: randomUUID(), status: LicenseStatus.REVOKED },
        ACTOR,
      ),
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
      new FakeAuditRecorder(),
    ).execute(
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

    const updated = await new ChangeLicenseStatusUseCase(
      repository,
      clock,
      new FakeAuditRecorder(),
    ).execute({ id: created.id.toString(), status: LicenseStatus.SUSPENDED }, ACTOR);

    expect(updated.status).toBe(LicenseStatus.SUSPENDED);
  });

  it("records an audit event with from/to metadata after a successful status change", async () => {
    const repository = new InMemoryLicenseRepository();
    const customerReader = new FakeCustomerReader();
    const customerId = randomUUID();
    customerReader.register({ id: customerId, active: true });
    const created = await new CreateLicenseUseCase(
      repository,
      customerReader,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    ).execute(
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
    const auditRecorder = new FakeAuditRecorder();

    await new ChangeLicenseStatusUseCase(repository, clock, auditRecorder).execute(
      { id: created.id.toString(), status: LicenseStatus.SUSPENDED },
      ACTOR,
    );

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: LICENSE_AUDIT_ACTIONS.STATUS_CHANGED,
        resourceType: LICENSE_AUDIT_RESOURCE_TYPE,
        resourceId: created.id.toString(),
        metadata: { from: LicenseStatus.ACTIVE, to: LicenseStatus.SUSPENDED },
      },
    ]);
  });
});
