import { randomUUID } from "node:crypto";
import { FakeLicenseSummaryReader } from "../../test-support/fake-readers";
import { GetLicenseSummariesUseCase } from "./get-license-summaries.use-case";

describe("GetLicenseSummariesUseCase", () => {
  it("returns a map keyed by id for a batch of ids", async () => {
    const reader = new FakeLicenseSummaryReader();
    const idA = randomUUID();
    reader.register({
      id: idA,
      licenseNumber: "LIC-GST-00001",
      edition: "BASIC",
      status: "ACTIVE",
    });

    const result = await new GetLicenseSummariesUseCase(reader).execute([idA]);

    expect(result.get(idA)?.licenseNumber).toBe("LIC-GST-00001");
  });

  it("returns an empty map for an empty id list without querying the port", async () => {
    const reader = new FakeLicenseSummaryReader();
    const findByIdsSpy = jest.spyOn(reader, "findByIds");

    const result = await new GetLicenseSummariesUseCase(reader).execute([]);

    expect(result.size).toBe(0);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });
});
