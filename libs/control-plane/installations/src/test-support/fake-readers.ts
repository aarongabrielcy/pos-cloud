import type {
  CustomerReaderPort,
  CustomerSummary,
} from "../application/ports/customer-reader.port";
import type {
  CustomerDisplaySummary,
  CustomerSummaryReaderPort,
} from "../application/ports/customer-summary-reader.port";
import type { LicenseReaderPort, LicenseSummary } from "../application/ports/license-reader.port";
import type {
  LicenseDisplaySummary,
  LicenseSummaryReaderPort,
} from "../application/ports/license-summary-reader.port";

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

export class FakeLicenseSummaryReader implements LicenseSummaryReaderPort {
  private readonly licenses = new Map<string, LicenseDisplaySummary>();

  register(summary: LicenseDisplaySummary): void {
    this.licenses.set(summary.id, summary);
  }

  async findByIds(ids: readonly string[]): Promise<Map<string, LicenseDisplaySummary>> {
    const result = new Map<string, LicenseDisplaySummary>();
    for (const id of ids) {
      const summary = this.licenses.get(id);
      if (summary) {
        result.set(id, summary);
      }
    }
    return result;
  }
}
