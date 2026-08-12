import type { Clock, IdGenerator } from "@pos-cloud/shared-kernel";
import { LicenseEdition } from "./license-edition";
import { LicenseId } from "./license-id";
import { LicenseModel } from "./license-model";
import { LicenseNumber } from "./license-number";
import { isLicenseStatusTransitionAllowed, LicenseStatus } from "./license-status";
import { type CreateLicenseEntitlementInput, LicenseEntitlement } from "./license-entitlement";
import {
  DuplicateEntitlementCodeError,
  InvalidLicenseEditionModelError,
  InvalidLicenseStatusTransitionError,
  InvalidLicenseValidityError,
  InvalidMaxInstallationsError,
} from "./license.errors";
import { EntitlementCode } from "./entitlement-code";

export interface LicenseProps {
  id: LicenseId;
  customerId: string;
  licenseNumber: LicenseNumber;
  edition: LicenseEdition;
  licenseModel: LicenseModel;
  status: LicenseStatus;
  validFrom: Date;
  validUntil: Date | null;
  maxInstallations: number;
  createdAt: Date;
  updatedAt: Date;
  entitlements: LicenseEntitlement[];
}

export interface ReplaceEntitlementItemInput {
  readonly code: string;
  readonly enabled: boolean;
  readonly configuration?: Record<string, unknown> | null;
}

export interface CreateLicenseInput {
  id: string;
  customerId: string;
  licenseNumber: string;
  edition: LicenseEdition;
  licenseModel: LicenseModel;
  validFrom: Date;
  validUntil: Date | null;
  maxInstallations: number;
  entitlements?: readonly ReplaceEntitlementItemInput[];
}

export class License {
  private constructor(private props: LicenseProps) {}

  static create(input: CreateLicenseInput, clock: Clock, idGenerator: IdGenerator): License {
    validateEditionModel(input.edition, input.licenseModel);
    validateValidity(input.licenseModel, input.validFrom, input.validUntil);
    validateMaxInstallations(input.maxInstallations);

    const now = clock.now();
    const license = new License({
      id: LicenseId.of(input.id),
      customerId: input.customerId,
      licenseNumber: LicenseNumber.create(input.licenseNumber),
      edition: input.edition,
      licenseModel: input.licenseModel,
      status: LicenseStatus.ACTIVE,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
      maxInstallations: input.maxInstallations,
      createdAt: now,
      updatedAt: now,
      entitlements: [],
    });

    if (input.entitlements && input.entitlements.length > 0) {
      license.replaceEntitlements(input.entitlements, idGenerator, clock);
    }

    return license;
  }

  /** Rehydrates a License (with its entitlements already loaded) from persisted state. */
  static reconstitute(props: LicenseProps): License {
    return new License(props);
  }

  changeStatus(next: LicenseStatus, clock: Clock): void {
    if (!isLicenseStatusTransitionAllowed(this.props.status, next)) {
      throw new InvalidLicenseStatusTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = clock.now();
  }

  /** PUT semantics: `items` is the complete desired entitlement set - replaces the collection wholesale. */
  replaceEntitlements(
    items: readonly ReplaceEntitlementItemInput[],
    idGenerator: IdGenerator,
    clock: Clock,
  ): void {
    const seen = new Set<string>();
    const next: LicenseEntitlement[] = [];

    for (const item of items) {
      const code = EntitlementCode.create(item.code);
      if (seen.has(code.toString())) {
        throw new DuplicateEntitlementCodeError(code.toString());
      }
      seen.add(code.toString());

      const entitlementInput: CreateLicenseEntitlementInput = {
        id: idGenerator.next(),
        licenseId: this.props.id.toString(),
        code: item.code,
        enabled: item.enabled,
        configuration: item.configuration,
      };
      next.push(LicenseEntitlement.create(entitlementInput, clock));
    }

    this.props.entitlements = next;
    this.props.updatedAt = clock.now();
  }

  /**
   * True only when status is ACTIVE AND `at` falls within [validFrom, validUntil] (validUntil
   * null means unbounded, i.e. PERPETUAL). A SUBSCRIPTION license past its validUntil is never
   * usable even if status is still ACTIVE - status alone is not enough.
   */
  isUsable(at: Date): boolean {
    if (this.props.status !== LicenseStatus.ACTIVE) {
      return false;
    }
    if (at < this.props.validFrom) {
      return false;
    }
    if (this.props.validUntil !== null && at > this.props.validUntil) {
      return false;
    }
    return true;
  }

  get id(): LicenseId {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get licenseNumber(): LicenseNumber {
    return this.props.licenseNumber;
  }

  get edition(): LicenseEdition {
    return this.props.edition;
  }

  get licenseModel(): LicenseModel {
    return this.props.licenseModel;
  }

  get status(): LicenseStatus {
    return this.props.status;
  }

  get validFrom(): Date {
    return this.props.validFrom;
  }

  get validUntil(): Date | null {
    return this.props.validUntil;
  }

  get maxInstallations(): number {
    return this.props.maxInstallations;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get entitlements(): readonly LicenseEntitlement[] {
    return this.props.entitlements;
  }
}

function validateEditionModel(edition: LicenseEdition, model: LicenseModel): void {
  const valid =
    (edition === LicenseEdition.BASIC && model === LicenseModel.PERPETUAL) ||
    (edition === LicenseEdition.PREMIUM && model === LicenseModel.SUBSCRIPTION);

  if (!valid) {
    throw new InvalidLicenseEditionModelError(edition, model);
  }
}

function validateValidity(model: LicenseModel, validFrom: Date, validUntil: Date | null): void {
  if (model === LicenseModel.PERPETUAL && validUntil !== null) {
    throw new InvalidLicenseValidityError("PERPETUAL licenses must have a null validUntil.");
  }

  if (model === LicenseModel.SUBSCRIPTION) {
    if (validUntil === null) {
      throw new InvalidLicenseValidityError("SUBSCRIPTION licenses require a validUntil.");
    }
    if (validUntil <= validFrom) {
      throw new InvalidLicenseValidityError("validUntil must be after validFrom.");
    }
  }
}

function validateMaxInstallations(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidMaxInstallationsError();
  }
}
