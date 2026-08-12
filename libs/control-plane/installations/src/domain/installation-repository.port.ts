import type { PaginatedResult, PaginationParams } from "@pos-cloud/shared-kernel";
import type { Installation } from "./installation";
import type { InstallationCode } from "./installation-code";
import type { InstallationId } from "./installation-id";
import type { InstallationStatus } from "./installation-status";
import type { Platform } from "./platform";

export interface ListInstallationsCriteria extends PaginationParams {
  readonly customerId?: string;
  readonly licenseId?: string;
  readonly platform?: Platform;
  readonly status?: InstallationStatus;
  /** Matched against installationCode and name. */
  readonly search?: string;
}

export interface InstallationRepository {
  findById(id: InstallationId): Promise<Installation | null>;
  findByCode(code: InstallationCode): Promise<Installation | null>;
  save(installation: Installation): Promise<void>;
  list(criteria: ListInstallationsCriteria): Promise<PaginatedResult<Installation>>;
  /** Counts installations for a license whose status is NOT DECOMMISSIONED - used for capacity checks. */
  countNonDecommissionedByLicense(licenseId: string): Promise<number>;
}

export const INSTALLATION_REPOSITORY = Symbol("INSTALLATION_REPOSITORY");
