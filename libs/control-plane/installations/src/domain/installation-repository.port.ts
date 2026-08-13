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

/**
 * `lastSeenAt` is the raw stored value (from a single correlated subquery against
 * installation_health, no N+1 - see typeorm-installation.repository.ts's `list()`) - `null` means no
 * heartbeat row exists yet. Computing the actual InstallationHealthStatus from it is deliberately left
 * to the application layer (ListInstallationsUseCase), which is the one place
 * `computeInstallationHealth` is called for this read path - see
 * docs/architecture/installation-health.md#health-read.
 */
export interface InstallationListItem {
  readonly installation: Installation;
  readonly lastSeenAt: Date | null;
}

export interface InstallationRepository {
  findById(id: InstallationId): Promise<Installation | null>;
  findByCode(code: InstallationCode): Promise<Installation | null>;
  save(installation: Installation): Promise<void>;
  list(criteria: ListInstallationsCriteria): Promise<PaginatedResult<InstallationListItem>>;
  /** Counts installations for a license whose status is NOT DECOMMISSIONED - used for capacity checks. */
  countNonDecommissionedByLicense(licenseId: string): Promise<number>;
}

export const INSTALLATION_REPOSITORY = Symbol("INSTALLATION_REPOSITORY");
