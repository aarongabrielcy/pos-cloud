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
  /** Batched lookup for read-model/display-summary purposes (e.g. Installations attaching a
   *  License display summary to its own responses) - a single query for the whole set of ids,
   *  never one call per id. Entitlements are intentionally omitted, same as list() - see that
   *  method's own comment. Order is not guaranteed; ids with no matching row are simply absent. */
  findByIds(ids: readonly string[]): Promise<License[]>;
}

export const LICENSE_REPOSITORY = Symbol("LICENSE_REPOSITORY");
