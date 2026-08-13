import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_RECORDER_PORT,
  type AuditActorContext,
  type AuditRecorderPort,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from "@pos-cloud/shared-kernel";
import { LICENSE_AUDIT_ACTIONS, LICENSE_AUDIT_RESOURCE_TYPE } from "../audit-actions";
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
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(
    command: ReplaceLicenseEntitlementsCommand,
    actor: AuditActorContext,
  ): Promise<License> {
    const license = await this.licenses.findById(LicenseId.of(command.licenseId));
    if (!license) {
      throw new LicenseNotFoundError(command.licenseId);
    }

    license.replaceEntitlements(command.entitlements, this.idGenerator, this.clock);
    await this.licenses.replaceEntitlements(license);

    await this.auditRecorder.record({
      actor,
      action: LICENSE_AUDIT_ACTIONS.ENTITLEMENTS_REPLACED,
      resourceType: LICENSE_AUDIT_RESOURCE_TYPE,
      resourceId: license.id.toString(),
      metadata: { entitlementCount: command.entitlements.length },
    });

    return license;
  }
}
