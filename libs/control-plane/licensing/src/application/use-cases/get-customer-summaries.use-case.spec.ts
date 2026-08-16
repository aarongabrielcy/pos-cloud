import { randomUUID } from "node:crypto";
import { FakeCustomerSummaryReader } from "../../test-support/fake-customer-summary-reader";
import { GetCustomerSummariesUseCase } from "./get-customer-summaries.use-case";

describe("GetCustomerSummariesUseCase", () => {
  it("returns a map keyed by id for a batch of ids", async () => {
    const reader = new FakeCustomerSummaryReader();
    const idA = randomUUID();
    const idB = randomUUID();
    reader.register({ id: idA, code: "GST-MX", legalName: "GS Trackme", tradeName: null });
    reader.register({ id: idB, code: "ACME", legalName: "Acme Corp", tradeName: "Acme" });

    const result = await new GetCustomerSummariesUseCase(reader).execute([idA, idB]);

    expect(result.get(idA)).toEqual({
      id: idA,
      code: "GST-MX",
      legalName: "GS Trackme",
      tradeName: null,
    });
    expect(result.get(idB)?.code).toBe("ACME");
  });

  it("omits ids with no matching summary rather than erroring", async () => {
    const reader = new FakeCustomerSummaryReader();

    const result = await new GetCustomerSummariesUseCase(reader).execute([randomUUID()]);

    expect(result.size).toBe(0);
  });

  it("returns an empty map for an empty id list without querying the port", async () => {
    const reader = new FakeCustomerSummaryReader();
    const findByIdsSpy = jest.spyOn(reader, "findByIds");

    const result = await new GetCustomerSummariesUseCase(reader).execute([]);

    expect(result.size).toBe(0);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });
});
