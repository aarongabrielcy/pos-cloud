import { Inject, Injectable } from "@nestjs/common";
import { type PaginatedResult, normalizePagination } from "@pos-cloud/shared-kernel";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../../domain/customer-repository.port";
import type { Customer } from "../../domain/customer";
import type { CustomerStatus } from "../../domain/customer-status";

export interface ListCustomersQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly status?: CustomerStatus;
  readonly search?: string;
}

@Injectable()
export class ListCustomersUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository) {}

  async execute(query: ListCustomersQuery): Promise<PaginatedResult<Customer>> {
    const pagination = normalizePagination(query);

    return this.customers.list({
      ...pagination,
      status: query.status,
      search: query.search,
    });
  }
}
