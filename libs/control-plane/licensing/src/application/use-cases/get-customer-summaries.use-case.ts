import { Inject, Injectable } from "@nestjs/common";
import {
  CUSTOMER_SUMMARY_READER_PORT,
  type CustomerDisplaySummary,
  type CustomerSummaryReaderPort,
} from "../ports/customer-summary-reader.port";

/**
 * Thin pass-through over CustomerSummaryReaderPort, existing only so LicenseController depends on
 * an injectable use case (this package's own convention - every controller here depends on
 * XxxUseCase classes, never a raw port) rather than holding a cross-context port directly.
 */
@Injectable()
export class GetCustomerSummariesUseCase {
  constructor(
    @Inject(CUSTOMER_SUMMARY_READER_PORT)
    private readonly customerSummaryReader: CustomerSummaryReaderPort,
  ) {}

  async execute(ids: readonly string[]): Promise<Map<string, CustomerDisplaySummary>> {
    if (ids.length === 0) {
      return new Map();
    }
    return this.customerSummaryReader.findByIds(ids);
  }
}
