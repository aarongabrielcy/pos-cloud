import type { PaginatedResult, PaginationParams } from "@pos-cloud/shared-kernel";
import type { License } from "./license";
import type { LicenseEdition } from "./license-edition";
import type { LicenseId } from "./license-id";
import type { LicenseNumber } from "./license-number";
import type { LicenseStatus } from "./license-status";

export interface ListLicensesCriteria extends PaginationParams {
  readonly customerId?: string;
  readonly status?: LicenseStatus;
  readonly edition?: LicenseEdition;
  /** Matched against licenseNumber. */
  readonly search?: string;
}

export interface LicenseRepository {
  findById(id: LicenseId): Promise<License | null>;
  findByLicenseNumber(licenseNumber: LicenseNumber): Promise<License | null>;
  /** Persists a License and its full entitlement collection atomically (single transaction). */
  save(license: License): Promise<void>;
  list(criteria: ListLicensesCriteria): Promise<PaginatedResult<License>>;
  /**
   * Persists the license's current `entitlements` collection atomically (delete-all-then-insert
   * within one transaction), after `license.replaceEntitlements(...)` has already computed it.
   */
  replaceEntitlements(license: License): Promise<void>;
}

export const LICENSE_REPOSITORY = Symbol("LICENSE_REPOSITORY");
