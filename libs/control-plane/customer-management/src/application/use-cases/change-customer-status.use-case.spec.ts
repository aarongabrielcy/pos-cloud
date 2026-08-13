import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CustomerStatus } from "../../domain/customer-status";
import {
  CustomerNotFoundError,
  InvalidCustomerStatusTransitionError,
} from "../../domain/customer.errors";
import { CUSTOMER_AUDIT_ACTIONS, CUSTOMER_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { CreateCustomerUseCase } from "./create-customer.use-case";
import { ChangeCustomerStatusUseCase } from "./change-customer-status.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

describe("ChangeCustomerStatusUseCase", () => {
  it("changes status for an existing customer", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme S.A." }, ACTOR);

    const updated = await new ChangeCustomerStatusUseCase(
      repository,
      clock,
      new FakeAuditRecorder(),
    ).execute({ id: created.id.toString(), status: CustomerStatus.SUSPENDED }, ACTOR);

    expect(updated.status).toBe(CustomerStatus.SUSPENDED);
  });

  it("throws CustomerNotFoundError for a missing customer", async () => {
    const repository = new InMemoryCustomerRepository();

    await expect(
      new ChangeCustomerStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
        { id: "00000000-0000-0000-0000-000000000000", status: CustomerStatus.SUSPENDED },
        ACTOR,
      ),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it("propagates invalid transition errors from the domain", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme S.A." }, ACTOR);
    await new ChangeCustomerStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
      { id: created.id.toString(), status: CustomerStatus.INACTIVE },
      ACTOR,
    );

    await expect(
      new ChangeCustomerStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
        { id: created.id.toString(), status: CustomerStatus.ACTIVE },
        ACTOR,
      ),
    ).rejects.toThrow(InvalidCustomerStatusTransitionError);
  });

  it("records an audit event with from/to metadata after a successful status change", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme S.A." }, ACTOR);
    const auditRecorder = new FakeAuditRecorder();

    await new ChangeCustomerStatusUseCase(repository, clock, auditRecorder).execute(
      { id: created.id.toString(), status: CustomerStatus.SUSPENDED },
      ACTOR,
    );

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: CUSTOMER_AUDIT_ACTIONS.STATUS_CHANGED,
        resourceType: CUSTOMER_AUDIT_RESOURCE_TYPE,
        resourceId: created.id.toString(),
        metadata: { from: CustomerStatus.ACTIVE, to: CustomerStatus.SUSPENDED },
      },
    ]);
  });
});
