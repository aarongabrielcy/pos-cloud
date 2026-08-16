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
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import {
  InstallationCodeAlreadyExistsError,
  InstallationCustomerNotActiveError,
  InstallationCustomerNotFoundError,
  InstallationLicenseNotFoundError,
  LicenseCapacityExceededError,
  LicenseCustomerMismatchError,
  LicenseNotUsableError,
} from "../../domain/installation.errors";
import type { Platform } from "../../domain/platform";
import { CUSTOMER_READER_PORT, type CustomerReaderPort } from "../ports/customer-reader.port";
import {
  INSTALLATION_CREATION_UNIT_OF_WORK,
  type InstallationCreationUnitOfWork,
} from "../ports/installation-creation-unit-of-work.port";
import { LICENSE_READER_PORT, type LicenseReaderPort } from "../ports/license-reader.port";

export interface CreateInstallationCommand {
  readonly customerId: string;
  readonly licenseId: string;
  readonly installationCode: string;
  readonly name: string;
  readonly platform: Platform;
}

@Injectable()
export class CreateInstallationUseCase {
  constructor(
    @Inject(CUSTOMER_READER_PORT) private readonly customerReader: CustomerReaderPort,
    @Inject(LICENSE_READER_PORT) private readonly licenseReader: LicenseReaderPort,
    @Inject(INSTALLATION_CREATION_UNIT_OF_WORK)
    private readonly creationUnitOfWork: InstallationCreationUnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(
    command: CreateInstallationCommand,
    actor: AuditActorContext,
  ): Promise<Installation> {
    // 1. Customer exists.
    const customer = await this.customerReader.findCustomerSummary(command.customerId);
    if (!customer) {
      throw new InstallationCustomerNotFoundError(command.customerId);
    }
    // 2. Customer is ACTIVE.
    if (!customer.active) {
      throw new InstallationCustomerNotActiveError(command.customerId);
    }

    // 3. License exists.
    const license = await this.licenseReader.findLicenseSummary(command.licenseId);
    if (!license) {
      throw new InstallationLicenseNotFoundError(command.licenseId);
    }
    // 4. License belongs to the same customer.
    if (license.customerId !== command.customerId) {
      throw new LicenseCustomerMismatchError();
    }
    // 5. License is usable (Licensing's own rule - status + validity dates).
    if (!license.usable) {
      throw new LicenseNotUsableError(command.licenseId);
    }

    // license.maxInstallations is immutable after License creation (no mutation endpoint ever
    // touches it), so it's safe to have read it above, before entering the lock below.
    const code = InstallationCode.create(command.installationCode);
    const installation = Installation.create(
      {
        id: this.idGenerator.next(),
        customerId: command.customerId,
        licenseId: command.licenseId,
        installationCode: command.installationCode,
        name: command.name,
        platform: command.platform,
      },
      this.clock,
    );

    // 6+7. Capacity check and installationCode-uniqueness check, immediately followed by save -
    // all three now serialized per-license via a Postgres advisory lock (see
    // InstallationCreationUnitOfWork's own comment). This closes the previously-known race where
    // two concurrent requests for the same license could both pass the capacity check before
    // either save() completed.
    await this.creationUnitOfWork.runExclusiveForLicense(command.licenseId, async (ctx) => {
      const current = await ctx.countNonDecommissionedByLicense(command.licenseId);
      if (current >= license.maxInstallations) {
        throw new LicenseCapacityExceededError(command.licenseId, license.maxInstallations);
      }

      const existing = await ctx.findInstallationByCode(code);
      if (existing) {
        throw new InstallationCodeAlreadyExistsError(code.toString());
      }

      await ctx.saveInstallation(installation);
    });

    await this.auditRecorder.record({
      actor,
      action: INSTALLATION_AUDIT_ACTIONS.CREATED,
      resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
      resourceId: installation.id.toString(),
      metadata: {},
    });

    return installation;
  }
}
