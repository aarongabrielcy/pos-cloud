/**
 * Generic pagination contract shared by every bounded context's "list" queries. Pure plumbing (no
 * business meaning), identical page/pageSize defaults and bounds everywhere, so it lives here
 * instead of being redefined per bounded context.
 */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MIN_PAGE_SIZE = 1;
export const MAX_PAGE_SIZE = 100;

/** page: default 1, minimum 1. pageSize: default 25, minimum 1, maximum 100. */
export function normalizePagination(input: { page?: number; pageSize?: number }): PaginationParams {
  const rawPage = Number.isFinite(input.page) ? Math.trunc(input.page as number) : DEFAULT_PAGE;
  const rawPageSize = Number.isFinite(input.pageSize)
    ? Math.trunc(input.pageSize as number)
    : DEFAULT_PAGE_SIZE;

  return {
    page: Math.max(DEFAULT_PAGE, rawPage),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, rawPageSize)),
  };
}

export function buildPaginatedResult<T>(
  items: readonly T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
