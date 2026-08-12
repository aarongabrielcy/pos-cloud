import type {
  CustomerReaderPort,
  CustomerSummary,
} from "../application/ports/customer-reader.port";
import type { LicenseReaderPort, LicenseSummary } from "../application/ports/license-reader.port";

/** Test doubles for the cross-context reader ports - never used in production code. */
export class FakeCustomerReader implements CustomerReaderPort {
  private readonly customers = new Map<string, CustomerSummary>();

  register(summary: CustomerSummary): void {
    this.customers.set(summary.id, summary);
  }

  async findCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
    return this.customers.get(customerId) ?? null;
  }
}

export class FakeLicenseReader implements LicenseReaderPort {
  private readonly licenses = new Map<string, LicenseSummary>();

  register(summary: LicenseSummary): void {
    this.licenses.set(summary.id, summary);
  }

  async findLicenseSummary(licenseId: string): Promise<LicenseSummary | null> {
    return this.licenses.get(licenseId) ?? null;
  }
}
