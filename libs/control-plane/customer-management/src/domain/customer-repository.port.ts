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
  /** Batched lookup for read-model/display-summary purposes (e.g. Licensing/Installations
   *  attaching a Customer display summary to their own responses) - a single query for the whole
   *  set of ids, never one call per id. Order is not guaranteed; ids with no matching row are
   *  simply absent from the result, never null-padded. */
  findByIds(ids: readonly string[]): Promise<Customer[]>;
}

export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
