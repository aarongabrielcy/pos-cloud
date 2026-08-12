/**
 * Installations owns this port. `usable` is computed by Licensing itself (via `License.isUsable`)
 * so Installations never has to know Licensing's usability rules - see Licensing's
 * GetLicenseSummaryUseCase, which the composition root's adapter delegates to.
 */
export interface LicenseSummary {
  readonly id: string;
  readonly customerId: string;
  readonly maxInstallations: number;
  readonly usable: boolean;
}

export interface LicenseReaderPort {
  findLicenseSummary(licenseId: string): Promise<LicenseSummary | null>;
}

export const LICENSE_READER_PORT = Symbol("INSTALLATIONS_LICENSE_READER_PORT");
