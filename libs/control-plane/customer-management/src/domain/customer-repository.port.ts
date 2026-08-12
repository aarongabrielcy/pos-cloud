import type { PaginatedResult, PaginationParams } from "@pos-cloud/shared-kernel";
import type { CustomerCode } from "./customer-code";
import type { CustomerId } from "./customer-id";
import type { CustomerStatus } from "./customer-status";
import type { Customer } from "./customer";

export interface ListCustomersCriteria extends PaginationParams {
  readonly status?: CustomerStatus;
  /** Matched reasonably against code, legalName, and tradeName. */
  readonly search?: string;
}

export interface CustomerRepository {
  findById(id: CustomerId): Promise<Customer | null>;
  findByCode(code: CustomerCode): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
  list(criteria: ListCustomersCriteria): Promise<PaginatedResult<Customer>>;
}

export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
