import type {
  CustomerReaderPort,
  CustomerSummary,
} from "../application/ports/customer-reader.port";

/** Test double for CustomerReaderPort - never used in production code. */
export class FakeCustomerReader implements CustomerReaderPort {
  private readonly customers = new Map<string, CustomerSummary>();

  register(summary: CustomerSummary): void {
    this.customers.set(summary.id, summary);
  }

  async findCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
    return this.customers.get(customerId) ?? null;
  }
}
