import { Injectable } from "@nestjs/common";
import { GetLicensesByIdsUseCase } from "@pos-cloud/licensing";

interface LicenseDisplaySummary {
  readonly id: string;
  readonly licenseNumber: string;
  readonly edition: string;
  readonly status: string;
}

/**
 * In-process adapter implementing Installations' `LicenseSummaryReaderPort`. Lives in the
 * composition root, never inside a bounded context package: it is the only place allowed to depend
 * on Licensing's public application API on behalf of another context.
 *
 * A single batched GetLicensesByIdsUseCase call per invocation - never one call per id.
 */
@Injectable()
export class LicenseSummaryReaderAdapter {
  constructor(private readonly getLicensesByIds: GetLicensesByIdsUseCase) {}

  async findByIds(ids: readonly string[]): Promise<Map<string, LicenseDisplaySummary>> {
    const licenses = await this.getLicensesByIds.execute(ids);
    const summaries = new Map<string, LicenseDisplaySummary>();
    for (const license of licenses) {
      summaries.set(license.id.toString(), {
        id: license.id.toString(),
        licenseNumber: license.licenseNumber.toString(),
        edition: license.edition,
        status: license.status,
      });
    }
    return summaries;
  }
}
