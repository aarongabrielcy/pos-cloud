import { randomUUID } from "node:crypto";
import { FakeCustomerSummaryReader } from "../../test-support/fake-readers";
import { GetCustomerSummariesUseCase } from "./get-customer-summaries.use-case";

describe("GetCustomerSummariesUseCase", () => {
  it("returns a map keyed by id for a batch of ids", async () => {
    const reader = new FakeCustomerSummaryReader();
    const idA = randomUUID();
    reader.register({ id: idA, code: "GST-MX", legalName: "GS Trackme", tradeName: null });

    const result = await new GetCustomerSummariesUseCase(reader).execute([idA]);

    expect(result.get(idA)?.code).toBe("GST-MX");
  });

  it("returns an empty map for an empty id list without querying the port", async () => {
    const reader = new FakeCustomerSummaryReader();
    const findByIdsSpy = jest.spyOn(reader, "findByIds");

    const result = await new GetCustomerSummariesUseCase(reader).execute([]);

    expect(result.size).toBe(0);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });
});
