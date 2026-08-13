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
  INSTALLATION_REPOSITORY,
  type InstallationRepository,
} from "../../domain/installation-repository.port";
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
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
    @Inject(CUSTOMER_READER_PORT) private readonly customerReader: CustomerReaderPort,
    @Inject(LICENSE_READER_PORT) private readonly licenseReader: LicenseReaderPort,
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

    // 6. Capacity: count installations for this license that are NOT DECOMMISSIONED.
    // NOTE: known race - two concurrent CreateInstallation requests for the same license can
    // both pass this count check before either save() completes. See docs/architecture for the
    // documented risk and the future transactional/locking mitigation; not addressed here.
    const current = await this.installations.countNonDecommissionedByLicense(command.licenseId);
    if (current >= license.maxInstallations) {
      throw new LicenseCapacityExceededError(command.licenseId, license.maxInstallations);
    }

    // 7. installationCode does not already exist.
    const code = InstallationCode.create(command.installationCode);
    const existing = await this.installations.findByCode(code);
    if (existing) {
      throw new InstallationCodeAlreadyExistsError(code.toString());
    }

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

    await this.installations.save(installation);

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
