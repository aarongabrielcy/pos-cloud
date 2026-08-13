import type { AuditActorContext } from "@pos-cloud/shared-kernel";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FakeAuditRecorder } from "../../test-support/fake-audit-recorder";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryCustomerRepository } from "../../test-support/in-memory-customer-repository";
import { CustomerStatus } from "../../domain/customer-status";
import { CreateCustomerUseCase } from "./create-customer.use-case";
import { ChangeCustomerStatusUseCase } from "./change-customer-status.use-case";
import { ListCustomersUseCase } from "./list-customers.use-case";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const ACTOR: AuditActorContext = {
  actorType: "ADMIN",
  actorId: "admin-1",
  correlationId: "correlation-1",
};

async function seed(repository: InMemoryCustomerRepository) {
  const createUseCase = new CreateCustomerUseCase(
    repository,
    clock,
    new RandomUuidGenerator(),
    new FakeAuditRecorder(),
  );
  await createUseCase.execute(
    { code: "GST-MX", legalName: "GS Trackme S.A.", tradeName: "GS Trackme" },
    ACTOR,
  );
  await createUseCase.execute({ code: "ACME-01", legalName: "Acme Corp" }, ACTOR);
  await createUseCase.execute({ code: "ACME-02", legalName: "Acme Two Corp" }, ACTOR);
}

describe("ListCustomersUseCase", () => {
  it("honors the pagination contract: items, page, pageSize, total, totalPages", async () => {
    const repository = new InMemoryCustomerRepository();
    await seed(repository);

    const result = await new ListCustomersUseCase(repository).execute({ page: 1, pageSize: 2 });

    expect(result).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(result.items).toHaveLength(2);
  });

  it("applies default pagination when omitted", async () => {
    const repository = new InMemoryCustomerRepository();
    await seed(repository);

    const result = await new ListCustomersUseCase(repository).execute({});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it("filters by status", async () => {
    const repository = new InMemoryCustomerRepository();
    await seed(repository);
    const [first] = (await repository.list({ page: 1, pageSize: 10 })).items;
    await new ChangeCustomerStatusUseCase(repository, clock, new FakeAuditRecorder()).execute(
      { id: first.id.toString(), status: CustomerStatus.SUSPENDED },
      ACTOR,
    );

    const result = await new ListCustomersUseCase(repository).execute({
      status: CustomerStatus.SUSPENDED,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.status).toBe(CustomerStatus.SUSPENDED);
  });

  it("searches by code, legalName, and tradeName", async () => {
    const repository = new InMemoryCustomerRepository();
    await seed(repository);

    await expect(
      new ListCustomersUseCase(repository).execute({ search: "gst" }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      new ListCustomersUseCase(repository).execute({ search: "acme" }),
    ).resolves.toMatchObject({ total: 2 });
    await expect(
      new ListCustomersUseCase(repository).execute({ search: "trackme" }),
    ).resolves.toMatchObject({ total: 1 });
  });
});
