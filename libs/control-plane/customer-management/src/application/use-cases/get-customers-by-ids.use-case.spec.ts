import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CreateCustomerUseCase } from "./create-customer.use-case";
import { GetCustomersByIdsUseCase } from "./get-customers-by-ids.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

describe("GetCustomersByIdsUseCase", () => {
  it("returns all matching customers for a batch of ids in one call", async () => {
    const repository = new InMemoryCustomerRepository();
    const createUseCase = new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    );
    const a = await createUseCase.execute({ code: "GST-MX", legalName: "GS Trackme" }, ACTOR);
    const b = await createUseCase.execute({ code: "ACME", legalName: "Acme Corp" }, ACTOR);

    const found = await new GetCustomersByIdsUseCase(repository).execute([
      a.id.toString(),
      b.id.toString(),
    ]);

    expect(found).toHaveLength(2);
    expect(found.map((c) => c.id.toString()).sort()).toEqual(
      [a.id.toString(), b.id.toString()].sort(),
    );
  });

  it("silently omits ids with no matching customer", async () => {
    const repository = new InMemoryCustomerRepository();
    const created = await new CreateCustomerUseCase(
      repository,
      clock,
      new RandomUuidGenerator(),
      new FakeAuditRecorder(),
    ).execute({ code: "GST-MX", legalName: "GS Trackme" }, ACTOR);

    const found = await new GetCustomersByIdsUseCase(repository).execute([
      created.id.toString(),
      "00000000-0000-0000-0000-000000000000",
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]?.id.toString()).toBe(created.id.toString());
  });

  it("returns an empty array for an empty id list without querying the repository", async () => {
    const repository = new InMemoryCustomerRepository();
    const findByIdsSpy = jest.spyOn(repository, "findByIds");

    const found = await new GetCustomersByIdsUseCase(repository).execute([]);

    expect(found).toEqual([]);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });
});
