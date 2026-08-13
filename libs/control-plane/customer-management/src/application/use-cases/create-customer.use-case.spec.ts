import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CustomerCodeAlreadyExistsError } from "../../domain/customer.errors";
import { CUSTOMER_AUDIT_ACTIONS, CUSTOMER_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { CreateCustomerUseCase } from "./create-customer.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

function setup() {
  const repository = new InMemoryCustomerRepository();
  const auditRecorder = new FakeAuditRecorder();
  const useCase = new CreateCustomerUseCase(
    repository,
    clock,
    new RandomUuidGenerator(),
    auditRecorder,
  );
  return { repository, useCase, auditRecorder };
}

describe("CreateCustomerUseCase", () => {
  it("creates and persists a Customer", async () => {
    const { repository, useCase } = setup();

    const customer = await useCase.execute({ code: "gst-mx", legalName: "GS Trackme S.A." }, ACTOR);

    expect(customer.code.toString()).toBe("GST-MX");
    await expect(repository.findByCode(customer.code)).resolves.toBe(customer);
  });

  it("rejects a duplicate customer code", async () => {
    const { useCase } = setup();
    await useCase.execute({ code: "GST-MX", legalName: "GS Trackme S.A." }, ACTOR);

    await expect(
      useCase.execute({ code: "gst-mx", legalName: "Another Legal Name" }, ACTOR),
    ).rejects.toThrow(CustomerCodeAlreadyExistsError);
  });

  it("records an audit event after the Customer is persisted", async () => {
    const { useCase, auditRecorder } = setup();

    const customer = await useCase.execute({ code: "GST-MX", legalName: "GS Trackme S.A." }, ACTOR);

    expect(auditRecorder.recorded).toEqual([
      {
        actor: ACTOR,
        action: CUSTOMER_AUDIT_ACTIONS.CREATED,
        resourceType: CUSTOMER_AUDIT_RESOURCE_TYPE,
        resourceId: customer.id.toString(),
        metadata: {},
      },
    ]);
  });

  it("does not record an audit event when creation fails", async () => {
    const { useCase, auditRecorder } = setup();
    await useCase.execute({ code: "GST-MX", legalName: "GS Trackme S.A." }, ACTOR);
    auditRecorder.recorded.length = 0;

    await expect(
      useCase.execute({ code: "gst-mx", legalName: "Another Legal Name" }, ACTOR),
    ).rejects.toThrow(CustomerCodeAlreadyExistsError);
    expect(auditRecorder.recorded).toHaveLength(0);
  });
});
