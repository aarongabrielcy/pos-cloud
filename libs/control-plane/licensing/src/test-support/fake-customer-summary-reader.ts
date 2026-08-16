import type {
  CustomerDisplaySummary,
  CustomerSummaryReaderPort,
} from "../application/ports/customer-summary-reader.port";

/** Test double for CustomerSummaryReaderPort - never used in production code. */
export class FakeCustomerSummaryReader implements CustomerSummaryReaderPort {
  private readonly customers = new Map<string, CustomerDisplaySummary>();

  register(summary: CustomerDisplaySummary): void {
    this.customers.set(summary.id, summary);
  }

  async findByIds(ids: readonly string[]): Promise<Map<string, CustomerDisplaySummary>> {
    const result = new Map<string, CustomerDisplaySummary>();
    for (const id of ids) {
      const summary = this.customers.get(id);
      if (summary) {
        result.set(id, summary);
      }
    }
    return result;
  }
}
