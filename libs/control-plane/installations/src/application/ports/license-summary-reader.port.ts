/**
 * Installations owns this port. Deliberately separate from LicenseReaderPort: that port answers
 * eligibility questions ("is this license usable, and what's its maxInstallations?") for
 * CreateInstallationUseCase; this one is a purely batched DISPLAY projection consumed by
 * InstallationController to attach a human-readable license summary to every Installation
 * response, without ever performing one lookup per row.
 */
export interface LicenseDisplaySummary {
  readonly id: string;
  readonly licenseNumber: string;
  readonly edition: string;
  readonly status: string;
}

export interface LicenseSummaryReaderPort {
  /** A single batched call for the whole id set - never one call per id. Ids with no matching
   *  License are simply absent from the returned map. */
  findByIds(ids: readonly string[]): Promise<Map<string, LicenseDisplaySummary>>;
}

export const LICENSE_SUMMARY_READER_PORT = Symbol("INSTALLATIONS_LICENSE_SUMMARY_READER_PORT");
