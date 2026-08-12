import type { PaginatedResult } from "@pos-cloud/shared-kernel";
import { buildPaginatedResult } from "@pos-cloud/shared-kernel";
import type { Installation } from "../domain/installation";
import type { InstallationCode } from "../domain/installation-code";
import type { InstallationId } from "../domain/installation-id";
import { InstallationStatus } from "../domain/installation-status";
import type {
  InstallationRepository,
  ListInstallationsCriteria,
} from "../domain/installation-repository.port";

/** Test double for InstallationRepository - never used in production code. */
export class InMemoryInstallationRepository implements InstallationRepository {
  private readonly byId = new Map<string, Installation>();

  async findById(id: InstallationId): Promise<Installation | null> {
    return this.byId.get(id.toString()) ?? null;
  }

  async findByCode(code: InstallationCode): Promise<Installation | null> {
    for (const installation of this.byId.values()) {
      if (installation.installationCode.equals(code)) {
        return installation;
      }
    }
    return null;
  }

  async save(installation: Installation): Promise<void> {
    this.byId.set(installation.id.toString(), installation);
  }

  async countNonDecommissionedByLicense(licenseId: string): Promise<number> {
    return [...this.byId.values()].filter(
      (installation) =>
        installation.licenseId === licenseId &&
        installation.status !== InstallationStatus.DECOMMISSIONED,
    ).length;
  }

  async list(criteria: ListInstallationsCriteria): Promise<PaginatedResult<Installation>> {
    let items = [...this.byId.values()];

    if (criteria.customerId) {
      items = items.filter((installation) => installation.customerId === criteria.customerId);
    }
    if (criteria.licenseId) {
      items = items.filter((installation) => installation.licenseId === criteria.licenseId);
    }
    if (criteria.platform) {
      items = items.filter((installation) => installation.platform === criteria.platform);
    }
    if (criteria.status) {
      items = items.filter((installation) => installation.status === criteria.status);
    }
    if (criteria.search) {
      const needle = criteria.search.toLowerCase();
      items = items.filter(
        (installation) =>
          installation.installationCode.toString().toLowerCase().includes(needle) ||
          installation.name.toLowerCase().includes(needle),
      );
    }

    const total = items.length;
    const start = (criteria.page - 1) * criteria.pageSize;
    const page = items.slice(start, start + criteria.pageSize);

    return buildPaginatedResult(page, total, criteria);
  }
}
