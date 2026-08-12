import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import type { License } from "../domain/license";
import type { LicenseId } from "../domain/license-id";
import type { LicenseNumber } from "../domain/license-number";
import type { LicenseRepository, ListLicensesCriteria } from "../domain/license-repository.port";

/** Test double for LicenseRepository - never used in production code. */
export class InMemoryLicenseRepository implements LicenseRepository {
  private readonly byId = new Map<string, License>();

  async findById(id: LicenseId): Promise<License | null> {
    return this.byId.get(id.toString()) ?? null;
  }

  async findByLicenseNumber(licenseNumber: LicenseNumber): Promise<License | null> {
    for (const license of this.byId.values()) {
      if (license.licenseNumber.equals(licenseNumber)) {
        return license;
      }
    }
    return null;
  }

  async save(license: License): Promise<void> {
    this.byId.set(license.id.toString(), license);
  }

  async replaceEntitlements(license: License): Promise<void> {
    this.byId.set(license.id.toString(), license);
  }

  async list(criteria: ListLicensesCriteria): Promise<PaginatedResult<License>> {
    let items = [...this.byId.values()];

    if (criteria.customerId) {
      items = items.filter((license) => license.customerId === criteria.customerId);
    }
    if (criteria.status) {
      items = items.filter((license) => license.status === criteria.status);
    }
    if (criteria.edition) {
      items = items.filter((license) => license.edition === criteria.edition);
    }
    if (criteria.search) {
      const needle = criteria.search.toLowerCase();
      items = items.filter((license) =>
        license.licenseNumber.toString().toLowerCase().includes(needle),
      );
    }

    const total = items.length;
    const start = (criteria.page - 1) * criteria.pageSize;
    const page = items.slice(start, start + criteria.pageSize);

    return buildPaginatedResult(page, total, criteria);
  }
}
