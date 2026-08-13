import { Inject, Injectable } from "@nestjs/common";
import { INSTALLATION_HEALTH_CONFIG, type InstallationHealthConfig } from "@pos-cloud/config";
import {
  CLOCK,
  type Clock,
  type PaginatedResult,
  normalizePagination,
} from "@pos-cloud/shared-kernel";
import { computeInstallationHealth } from "../../domain/compute-installation-health";
import type { Installation } from "../../domain/installation";
import type { InstallationHealthStatus } from "../../domain/installation-health-status";
import {
  INSTALLATION_REPOSITORY,
  type InstallationRepository,
} from "../../domain/installation-repository.port";
import type { InstallationStatus } from "../../domain/installation-status";
import type { Platform } from "../../domain/platform";

export interface ListInstallationsQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly customerId?: string;
  readonly licenseId?: string;
  readonly platform?: Platform;
  readonly status?: InstallationStatus;
  readonly search?: string;
}

export interface InstallationListItemWithHealth {
  readonly installation: Installation;
  readonly healthStatus: InstallationHealthStatus;
  readonly lastSeenAt: Date | null;
}

/**
 * The one place `computeInstallationHealth` is called for the list read path - the repository's
 * single LEFT JOIN query supplies raw `lastSeenAt` per row (no N+1), and this use case is the sole
 * application-layer authority that turns it into a healthStatus, so SQL and TypeScript can never
 * duplicate/diverge on threshold logic (see docs/architecture/installation-health.md#health-read).
 */
@Injectable()
export class ListInstallationsUseCase {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
    @Inject(INSTALLATION_HEALTH_CONFIG) private readonly healthConfig: InstallationHealthConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(
    query: ListInstallationsQuery,
  ): Promise<PaginatedResult<InstallationListItemWithHealth>> {
    const pagination = normalizePagination(query);

    const result = await this.installations.list({
      ...pagination,
      customerId: query.customerId,
      licenseId: query.licenseId,
      platform: query.platform,
      status: query.status,
      search: query.search,
    });

    const now = this.clock.now();
    const thresholds = {
      staleAfterSeconds: this.healthConfig.staleAfterSeconds,
      offlineAfterSeconds: this.healthConfig.offlineAfterSeconds,
    };

    return {
      ...result,
      items: result.items.map((item) => ({
        installation: item.installation,
        lastSeenAt: item.lastSeenAt,
        healthStatus: computeInstallationHealth(
          item.installation.status,
          item.lastSeenAt,
          now,
          thresholds,
        ),
      })),
    };
  }
}
