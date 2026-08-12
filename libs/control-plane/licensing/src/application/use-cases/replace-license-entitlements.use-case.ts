import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from "@pos-cloud/shared-kernel";
import type { License, ReplaceEntitlementItemInput } from "../../domain/license";
import { LicenseId } from "../../domain/license-id";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";
import { LicenseNotFoundError } from "../../domain/license.errors";

export interface ReplaceLicenseEntitlementsCommand {
  readonly licenseId: string;
  readonly entitlements: readonly ReplaceEntitlementItemInput[];
}

@Injectable()
export class ReplaceLicenseEntitlementsUseCase {
  constructor(
    @Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ReplaceLicenseEntitlementsCommand): Promise<License> {
    const license = await this.licenses.findById(LicenseId.of(command.licenseId));
    if (!license) {
      throw new LicenseNotFoundError(command.licenseId);
    }

    license.replaceEntitlements(command.entitlements, this.idGenerator, this.clock);
    await this.licenses.replaceEntitlements(license);

    return license;
  }
}
