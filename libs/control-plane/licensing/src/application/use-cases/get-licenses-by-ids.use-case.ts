import { Inject, Injectable } from "@nestjs/common";
import type { License } from "../../domain/license";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";

/**
 * Minimal cross-context batch query - not wired to any HTTP route. Exists solely so the composition
 * root can build Installations' LicenseSummaryReaderPort adapter without exposing the full License
 * aggregate/repository to another bounded context - same reasoning as GetLicenseSummaryUseCase,
 * batched.
 */
@Injectable()
export class GetLicensesByIdsUseCase {
  constructor(@Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository) {}

  async execute(ids: readonly string[]): Promise<License[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.licenses.findByIds(ids);
  }
}
