import { Inject, Injectable } from "@nestjs/common";
import {
  LICENSE_SUMMARY_READER_PORT,
  type LicenseDisplaySummary,
  type LicenseSummaryReaderPort,
} from "../ports/license-summary-reader.port";

/** Thin pass-through over LicenseSummaryReaderPort - same reasoning as GetCustomerSummariesUseCase. */
@Injectable()
export class GetLicenseSummariesUseCase {
  constructor(
    @Inject(LICENSE_SUMMARY_READER_PORT)
    private readonly licenseSummaryReader: LicenseSummaryReaderPort,
  ) {}

  async execute(ids: readonly string[]): Promise<Map<string, LicenseDisplaySummary>> {
    if (ids.length === 0) {
      return new Map();
    }
    return this.licenseSummaryReader.findByIds(ids);
  }
}
