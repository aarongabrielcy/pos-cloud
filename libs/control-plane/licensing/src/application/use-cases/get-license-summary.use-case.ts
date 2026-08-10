import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import { LicenseId } from "../../domain/license-id";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";

/**
 * Minimal cross-context query - not wired to any HTTP route. Exists solely so the composition
 * root can build Installations' LicenseReaderPort adapter without exposing the full License
 * aggregate or Licensing's usability rules to another bounded context: `usable` is computed here
 * (via `License.isUsable`), so Installations never has to know how Licensing defines usability.
 */
export interface LicenseSummary {
  readonly id: string;
  readonly customerId: string;
  readonly maxInstallations: number;
  readonly usable: boolean;
}

@Injectable()
export class GetLicenseSummaryUseCase {
  constructor(
    @Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<LicenseSummary | null> {
    const license = await this.licenses.findById(LicenseId.of(id));
    if (!license) {
      return null;
    }

    return {
      id: license.id.toString(),
      customerId: license.customerId,
      maxInstallations: license.maxInstallations,
      usable: license.isUsable(this.clock.now()),
    };
  }
}
