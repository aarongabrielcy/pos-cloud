import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CustomerCodeAlreadyExistsError } from "../../domain/customer.errors";
import { CreateCustomerUseCase } from "./create-customer.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function setup() {
  const repository = new InMemoryCustomerRepository();
  const useCase = new CreateCustomerUseCase(repository, clock, new RandomUuidGenerator());
  return { repository, useCase };
}

describe("CreateCustomerUseCase", () => {
  it("creates and persists a Customer", async () => {
    const { repository, useCase } = setup();

    const customer = await useCase.execute({ code: "gst-mx", legalName: "GS Trackme S.A." });

    expect(customer.code.toString()).toBe("GST-MX");
    await expect(repository.findByCode(customer.code)).resolves.toBe(customer);
  });

  it("rejects a duplicate customer code", async () => {
    const { useCase } = setup();
    await useCase.execute({ code: "GST-MX", legalName: "GS Trackme S.A." });

    await expect(
      useCase.execute({ code: "gst-mx", legalName: "Another Legal Name" }),
    ).rejects.toThrow(CustomerCodeAlreadyExistsError);
  });
});
