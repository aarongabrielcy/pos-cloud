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
import { License, type ReplaceEntitlementItemInput } from "../../domain/license";
import type { LicenseEdition } from "../../domain/license-edition";
import type { LicenseModel } from "../../domain/license-model";
import { LicenseNumber } from "../../domain/license-number";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";
import {
  CustomerNotEligibleForLicenseError,
  LicenseCustomerNotFoundError,
  LicenseNumberAlreadyExistsError,
} from "../../domain/license.errors";
import { CUSTOMER_READER_PORT, type CustomerReaderPort } from "../ports/customer-reader.port";

export interface CreateLicenseCommand {
  readonly customerId: string;
  readonly licenseNumber: string;
  readonly edition: LicenseEdition;
  readonly licenseModel: LicenseModel;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly maxInstallations: number;
  readonly entitlements?: readonly ReplaceEntitlementItemInput[];
}

@Injectable()
export class CreateLicenseUseCase {
  constructor(
    @Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository,
    @Inject(CUSTOMER_READER_PORT) private readonly customerReader: CustomerReaderPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(command: CreateLicenseCommand, actor: AuditActorContext): Promise<License> {
    const customer = await this.customerReader.findCustomerSummary(command.customerId);
    if (!customer) {
      throw new LicenseCustomerNotFoundError(command.customerId);
    }
    if (!customer.active) {
      throw new CustomerNotEligibleForLicenseError(command.customerId);
    }

    const licenseNumber = LicenseNumber.create(command.licenseNumber);

    // Known race, same shape documented on CreateCustomerUseCase - the `licenses.license_number`
    // UNIQUE constraint in PostgreSQL is the real guard; the repository adapter translates that
    // constraint violation into this same error.
    const existing = await this.licenses.findByLicenseNumber(licenseNumber);
    if (existing) {
      throw new LicenseNumberAlreadyExistsError(licenseNumber.toString());
    }

    const license = License.create(
      {
        id: this.idGenerator.next(),
        customerId: command.customerId,
        licenseNumber: command.licenseNumber,
        edition: command.edition,
        licenseModel: command.licenseModel,
        validFrom: command.validFrom,
        validUntil: command.validUntil,
        maxInstallations: command.maxInstallations,
        entitlements: command.entitlements,
      },
      this.clock,
      this.idGenerator,
    );

    await this.licenses.save(license);

    await this.auditRecorder.record({
      actor,
      action: LICENSE_AUDIT_ACTIONS.CREATED,
      resourceType: LICENSE_AUDIT_RESOURCE_TYPE,
      resourceId: license.id.toString(),
      metadata: {},
    });

    return license;
  }
}
