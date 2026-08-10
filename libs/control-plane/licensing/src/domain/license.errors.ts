import { ConflictError, NotFoundError, ValidationError } from "@pos-cloud/shared-kernel";

export class InvalidLicenseNumberError extends ValidationError {
  constructor(value: string) {
    super(
      "INVALID_LICENSE_NUMBER",
      `Invalid license number: "${value}". Expected 5-80 chars matching ^[A-Z0-9][A-Z0-9_-]{4,79}$ (after trim/uppercase).`,
    );
  }
}

export class InvalidLicenseEditionModelError extends ValidationError {
  constructor(edition: string, model: string) {
    super(
      "INVALID_LICENSE_EDITION_MODEL",
      `Unsupported combination: edition=${edition} with licenseModel=${model}. Currently BASIC requires PERPETUAL and PREMIUM requires SUBSCRIPTION.`,
    );
  }
}

export class InvalidLicenseValidityError extends ValidationError {
  constructor(message: string) {
    super("INVALID_LICENSE_VALIDITY", message);
  }
}

export class InvalidMaxInstallationsError extends ValidationError {
  constructor() {
    super("INVALID_MAX_INSTALLATIONS", "maxInstallations must be an integer >= 1.");
  }
}

export class InvalidLicenseStatusTransitionError extends ValidationError {
  constructor(from: string, to: string) {
    super(
      "INVALID_LICENSE_STATUS_TRANSITION",
      `Cannot transition License status from ${from} to ${to}.`,
    );
  }
}

export class LicenseNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("LICENSE_NOT_FOUND", `License not found: ${id}`);
  }
}

export class LicenseNumberAlreadyExistsError extends ConflictError {
  constructor(licenseNumber: string) {
    super("LICENSE_NUMBER_ALREADY_EXISTS", `License number already exists: ${licenseNumber}`);
  }
}

export class InvalidEntitlementCodeError extends ValidationError {
  constructor(value: string) {
    super(
      "INVALID_ENTITLEMENT_CODE",
      `Invalid entitlement code: "${value}". Expected snake_case matching ^[a-z][a-z0-9_]{2,99}$.`,
    );
  }
}

export class DuplicateEntitlementCodeError extends ValidationError {
  constructor(code: string) {
    super("DUPLICATE_ENTITLEMENT_CODE", `Duplicate entitlement code in the same request: ${code}`);
  }
}

export class InvalidEntitlementConfigurationError extends ValidationError {
  constructor() {
    super(
      "INVALID_ENTITLEMENT_CONFIGURATION",
      "Entitlement configuration must be a JSON object (not an array, string, or number) when present.",
    );
  }
}

/** Raised by CreateLicenseUseCase when the referenced customer fails the cross-context check. */
export class LicenseCustomerNotFoundError extends NotFoundError {
  constructor(customerId: string) {
    super("CUSTOMER_NOT_FOUND", `Customer not found: ${customerId}`);
  }
}

export class CustomerNotEligibleForLicenseError extends ConflictError {
  constructor(customerId: string) {
    super(
      "CUSTOMER_NOT_ELIGIBLE_FOR_LICENSE",
      `Customer ${customerId} is not ACTIVE and cannot receive a new license.`,
    );
  }
}
