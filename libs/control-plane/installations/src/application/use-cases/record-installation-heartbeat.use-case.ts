import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "@pos-cloud/shared-kernel";
import {
  INSTALLATION_HEALTH_WRITER,
  type InstallationHealthWriterPort,
} from "../ports/installation-health-writer.port";

export interface RecordInstallationHeartbeatCommand {
  /** From the authenticated machine principal (@CurrentInstallation()) - never from the request body. */
  readonly installationId: string;
  readonly appVersion: string;
  readonly clientReportedAt: Date | null;
}

/**
 * No credential/ACTIVE/SUSPENDED/DECOMMISSIONED check here - InstallationAuthGuard is already the
 * sole authority for machine authentication and status (401/403 before this use case ever runs, see
 * docs/architecture/installation-health.md#heartbeat-endpoint). Not audited - see
 * docs/architecture/audit.md#non-goals: heartbeats are telemetry, not administrative actions.
 */
@Injectable()
export class RecordInstallationHeartbeatUseCase {
  constructor(
    @Inject(INSTALLATION_HEALTH_WRITER) private readonly healthWriter: InstallationHealthWriterPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(command: RecordInstallationHeartbeatCommand): Promise<void> {
    await this.healthWriter.recordHeartbeat({
      installationId: command.installationId,
      receivedAt: this.clock.now(),
      appVersion: command.appVersion,
      clientReportedAt: command.clientReportedAt,
    });
  }
}
