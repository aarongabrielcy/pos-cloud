import { Inject, Injectable } from "@nestjs/common";
import { type PaginatedResult, normalizePagination } from "@pos-cloud/shared-kernel";
import type { Installation } from "../../domain/installation";
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

@Injectable()
export class ListInstallationsUseCase {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
  ) {}

  async execute(query: ListInstallationsQuery): Promise<PaginatedResult<Installation>> {
    const pagination = normalizePagination(query);

    return this.installations.list({
      ...pagination,
      customerId: query.customerId,
      licenseId: query.licenseId,
      platform: query.platform,
      status: query.status,
      search: query.search,
    });
  }
}
