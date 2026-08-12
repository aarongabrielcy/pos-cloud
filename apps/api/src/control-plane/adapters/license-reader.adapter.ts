import { Injectable } from "@nestjs/common";
import { GetLicenseSummaryUseCase } from "@pos-cloud/licensing";
import type { LicenseSummary } from "@pos-cloud/installations";

/**
 * In-process adapter implementing Installations' `LicenseReaderPort`. Delegates to Licensing's
 * GetLicenseSummaryUseCase, which computes `usable` internally (via `License.isUsable`) - this
 * adapter, and Installations itself, never need to know Licensing's usability rules.
 */
@Injectable()
export class LicenseReaderAdapter {
  constructor(private readonly getLicenseSummary: GetLicenseSummaryUseCase) {}

  async findLicenseSummary(licenseId: string): Promise<LicenseSummary | null> {
    return this.getLicenseSummary.execute(licenseId);
  }
}
