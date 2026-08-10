import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import type { Customer } from "../domain/customer";
import type { CustomerCode } from "../domain/customer-code";
import type { CustomerId } from "../domain/customer-id";
import type { CustomerRepository, ListCustomersCriteria } from "../domain/customer-repository.port";

/** Test double for CustomerRepository - never used in production code. */
export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly byId = new Map<string, Customer>();

  async findById(id: CustomerId): Promise<Customer | null> {
    return this.byId.get(id.toString()) ?? null;
  }

  async findByCode(code: CustomerCode): Promise<Customer | null> {
    for (const customer of this.byId.values()) {
      if (customer.code.equals(code)) {
        return customer;
      }
    }
    return null;
  }

  async save(customer: Customer): Promise<void> {
    this.byId.set(customer.id.toString(), customer);
  }

  async list(criteria: ListCustomersCriteria): Promise<PaginatedResult<Customer>> {
    let items = [...this.byId.values()];

    if (criteria.status) {
      items = items.filter((customer) => customer.status === criteria.status);
    }
    if (criteria.search) {
      const needle = criteria.search.toLowerCase();
      items = items.filter(
        (customer) =>
          customer.code.toString().toLowerCase().includes(needle) ||
          customer.legalName.toString().toLowerCase().includes(needle) ||
          (customer.tradeName?.toString().toLowerCase().includes(needle) ?? false),
      );
    }

    const total = items.length;
    const start = (criteria.page - 1) * criteria.pageSize;
    const page = items.slice(start, start + criteria.pageSize);

    return buildPaginatedResult(page, total, criteria);
  }
}
