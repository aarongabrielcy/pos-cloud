import { Inject, Injectable } from "@nestjs/common";
import type { Customer } from "../../domain/customer";
import {
  CUSTOMER_REPOSITORY,
  type CustomerRepository,
} from "../../domain/customer-repository.port";

/**
 * Minimal cross-context batch query - not wired to any HTTP route. Exists solely so the composition
 * root can build Licensing's/Installations' CustomerSummaryReaderPort adapters without exposing the
 * full CustomerRepository (or any single-id-only reader) to another bounded context - same
 * reasoning as GetCustomerByIdUseCase, batched.
 */
@Injectable()
export class GetCustomersByIdsUseCase {
  constructor(@Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository) {}

  async execute(ids: readonly string[]): Promise<Customer[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.customers.findByIds(ids);
  }
}
