import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import type { License } from "../../domain/license";
import { LicenseId } from "../../domain/license-id";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";
import type { LicenseStatus } from "../../domain/license-status";
import { LicenseNotFoundError } from "../../domain/license.errors";

export interface ChangeLicenseStatusCommand {
  readonly id: string;
  readonly status: LicenseStatus;
}

@Injectable()
export class ChangeLicenseStatusUseCase {
  constructor(
    @Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ChangeLicenseStatusCommand): Promise<License> {
    const license = await this.licenses.findById(LicenseId.of(command.id));
    if (!license) {
      throw new LicenseNotFoundError(command.id);
    }

    license.changeStatus(command.status, this.clock);
    await this.licenses.save(license);

    return license;
  }
}
