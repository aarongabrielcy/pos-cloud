import { Inject, Injectable } from "@nestjs/common";
import { INSTALLATION_HEALTH_CONFIG, type InstallationHealthConfig } from "@pos-cloud/config";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import { computeInstallationHealth } from "../../domain/compute-installation-health";
import { InstallationId } from "../../domain/installation-id";
import type { InstallationHealthStatus } from "../../domain/installation-health-status";
import {
  INSTALLATION_REPOSITORY,
  type InstallationRepository,
} from "../../domain/installation-repository.port";
import type { InstallationStatus } from "../../domain/installation-status";
import {
  INSTALLATION_HEALTH_READER,
  type InstallationHealthReaderPort,
} from "../ports/installation-health-reader.port";

export interface InstallationHealthDetail {
  readonly installationId: string;
  readonly lifecycleStatus: InstallationStatus;
  readonly healthStatus: InstallationHealthStatus;
  readonly lastSeenAt: Date | null;
  readonly firstSeenAt: Date | null;
  readonly appVersion: string | null;
  readonly clientReportedAt: Date | null;
}

/**
 * Two reads (Installation for lifecycleStatus, installation_health for the snapshot) - a single
 * detail view issuing 2 queries is normal and is not the N+1 concern section 12 of the design
 * warns about (that's specifically about the LIST endpoint, see ListInstallationsUseCase).
 * `computeInstallationHealth` is the same pure function the list path uses, so the two can never
 * diverge.
 */
@Injectable()
export class GetInstallationHealthUseCase {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
    @Inject(INSTALLATION_HEALTH_READER) private readonly healthReader: InstallationHealthReaderPort,
    @Inject(INSTALLATION_HEALTH_CONFIG) private readonly config: InstallationHealthConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(installationId: string): Promise<InstallationHealthDetail | null> {
    const installation = await this.installations.findById(InstallationId.of(installationId));
    if (!installation) {
      return null;
    }

    const snapshot = await this.healthReader.findByInstallationId(installationId);
    const lastSeenAt = snapshot?.lastSeenAt ?? null;

    return {
      installationId,
      lifecycleStatus: installation.status,
      healthStatus: computeInstallationHealth(installation.status, lastSeenAt, this.clock.now(), {
        staleAfterSeconds: this.config.staleAfterSeconds,
        offlineAfterSeconds: this.config.offlineAfterSeconds,
      }),
      lastSeenAt,
      firstSeenAt: snapshot?.firstSeenAt ?? null,
      appVersion: snapshot?.appVersion ?? null,
      clientReportedAt: snapshot?.clientReportedAt ?? null,
    };
  }
}
