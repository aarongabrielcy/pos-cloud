import { Inject, Injectable } from "@nestjs/common";
import { type PaginatedResult, normalizePagination } from "@pos-cloud/shared-kernel";
import type { LicenseEdition } from "../../domain/license-edition";
import type { License } from "../../domain/license";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";
import type { LicenseStatus } from "../../domain/license-status";

export interface ListLicensesQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly customerId?: string;
  readonly status?: LicenseStatus;
  readonly edition?: LicenseEdition;
  readonly search?: string;
}

@Injectable()
export class ListLicensesUseCase {
  constructor(@Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository) {}

  async execute(query: ListLicensesQuery): Promise<PaginatedResult<License>> {
    const pagination = normalizePagination(query);

    return this.licenses.list({
      ...pagination,
      customerId: query.customerId,
      status: query.status,
      edition: query.edition,
      search: query.search,
    });
  }
}
