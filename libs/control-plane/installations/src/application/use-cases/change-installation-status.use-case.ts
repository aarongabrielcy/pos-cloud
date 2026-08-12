import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import type { Installation } from "../../domain/installation";
import { InstallationId } from "../../domain/installation-id";
import {
  INSTALLATION_REPOSITORY,
  type InstallationRepository,
} from "../../domain/installation-repository.port";
import type { InstallationStatus } from "../../domain/installation-status";
import { InstallationNotFoundError } from "../../domain/installation.errors";

export interface ChangeInstallationStatusCommand {
  readonly id: string;
  readonly status: InstallationStatus;
}

/**
 * Administrative status change only - delegates to `Installation.changeStatus`, whose transition
 * table excludes PENDING -> ACTIVE by design. There is no use case in this package that calls
 * `Installation.activate()`.
 */
@Injectable()
export class ChangeInstallationStatusUseCase {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: ChangeInstallationStatusCommand): Promise<Installation> {
    const installation = await this.installations.findById(InstallationId.of(command.id));
    if (!installation) {
      throw new InstallationNotFoundError(command.id);
    }

    installation.changeStatus(command.status, this.clock);
    await this.installations.save(installation);

    return installation;
  }
}
