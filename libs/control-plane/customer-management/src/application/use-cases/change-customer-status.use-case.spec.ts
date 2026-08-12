import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CustomerStatus } from "../../domain/customer-status";
import {
  CustomerNotFoundError,
  InvalidCustomerStatusTransitionError,
} from "../../domain/customer.errors";
import { CreateCustomerUseCase } from "./create-customer.use-case";
import { ChangeCustomerStatusUseCase } from "./change-customer-status.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("ChangeCustomerStatusUseCase", () => {
  it("changes status for an existing customer", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme S.A." });

    const updated = await new ChangeCustomerStatusUseCase(repository, clock).execute({
      id: created.id.toString(),
      status: CustomerStatus.SUSPENDED,
    });

    expect(updated.status).toBe(CustomerStatus.SUSPENDED);
  });

  it("throws CustomerNotFoundError for a missing customer", async () => {
    const repository = new InMemoryCustomerRepository();

    await expect(
      new ChangeCustomerStatusUseCase(repository, clock).execute({
        id: "00000000-0000-0000-0000-000000000000",
        status: CustomerStatus.SUSPENDED,
      }),
    ).rejects.toThrow(CustomerNotFoundError);
  });

  it("propagates invalid transition errors from the domain", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme S.A." });
    await new ChangeCustomerStatusUseCase(repository, clock).execute({
      id: created.id.toString(),
      status: CustomerStatus.INACTIVE,
    });

    await expect(
      new ChangeCustomerStatusUseCase(repository, clock).execute({
        id: created.id.toString(),
        status: CustomerStatus.ACTIVE,
      }),
    ).rejects.toThrow(InvalidCustomerStatusTransitionError);
  });
});
