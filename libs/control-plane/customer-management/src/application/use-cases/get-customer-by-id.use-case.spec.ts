import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CreateCustomerUseCase } from "./create-customer.use-case";
import { GetCustomerByIdUseCase } from "./get-customer-by-id.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("GetCustomerByIdUseCase", () => {
  it("returns the customer when it exists", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme S.A." });

    const found = await new GetCustomerByIdUseCase(repository).execute(created.id.toString());

    expect(found).toBe(created);
  });

  it("returns null when the customer does not exist", async () => {
    const repository = new InMemoryCustomerRepository();

    const found = await new GetCustomerByIdUseCase(repository).execute(
      "00000000-0000-0000-0000-000000000000",
    );

    expect(found).toBeNull();
  });
});
