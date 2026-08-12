import { buildPaginatedResult, normalizePagination } from "./pagination";

describe("normalizePagination", () => {
  it("defaults to page 1, pageSize 25 when omitted", () => {
    expect(normalizePagination({})).toEqual({ page: 1, pageSize: 25 });
  });

  it("clamps page to a minimum of 1", () => {
    expect(normalizePagination({ page: 0 })).toEqual({ page: 1, pageSize: 25 });
    expect(normalizePagination({ page: -5 })).toEqual({ page: 1, pageSize: 25 });
  });

  it("clamps pageSize to [1, 100]", () => {
    expect(normalizePagination({ pageSize: 0 }).pageSize).toBe(1);
    expect(normalizePagination({ pageSize: 500 }).pageSize).toBe(100);
    expect(normalizePagination({ pageSize: 40 }).pageSize).toBe(40);
  });

  it("truncates non-integer input", () => {
    expect(normalizePagination({ page: 2.9, pageSize: 10.5 })).toEqual({ page: 2, pageSize: 10 });
  });
});

describe("buildPaginatedResult", () => {
  it("computes totalPages from total and pageSize", () => {
    const result = buildPaginatedResult(["a", "b"], 45, { page: 2, pageSize: 20 });

    expect(result).toEqual({
      items: ["a", "b"],
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("returns 0 totalPages when total is 0", () => {
    const result = buildPaginatedResult([], 0, { page: 1, pageSize: 25 });

    expect(result.totalPages).toBe(0);
  });
});
