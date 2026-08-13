import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_RECORDER_PORT,
  type AuditActorContext,
  type AuditRecorderPort,
  CLOCK,
  type Clock,
} from "@pos-cloud/shared-kernel";
import { LICENSE_AUDIT_ACTIONS, LICENSE_AUDIT_RESOURCE_TYPE } from "../audit-actions";
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
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(command: ChangeLicenseStatusCommand, actor: AuditActorContext): Promise<License> {
    const license = await this.licenses.findById(LicenseId.of(command.id));
    if (!license) {
      throw new LicenseNotFoundError(command.id);
    }

    const from = license.status;
    license.changeStatus(command.status, this.clock);
    await this.licenses.save(license);

    await this.auditRecorder.record({
      actor,
      action: LICENSE_AUDIT_ACTIONS.STATUS_CHANGED,
      resourceType: LICENSE_AUDIT_RESOURCE_TYPE,
      resourceId: license.id.toString(),
      metadata: { from, to: license.status },
    });

    return license;
  }
}
