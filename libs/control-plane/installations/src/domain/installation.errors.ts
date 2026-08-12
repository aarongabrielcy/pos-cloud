import { ConflictError, NotFoundError, ValidationError } from "@pos-cloud/shared-kernel";

export class InvalidInstallationCodeError extends ValidationError {
  constructor(value: string) {
    super(
      "INVALID_INSTALLATION_CODE",
      `Invalid installation code: "${value}". Expected 5-80 chars matching ^[A-Z0-9][A-Z0-9_-]{4,79}$ (after trim/uppercase).`,
    );
  }
}

export class InvalidInstallationNameError extends ValidationError {
  constructor() {
    super("INVALID_INSTALLATION_NAME", "Installation name must be 1-150 characters after trim.");
  }
}

export class InvalidInstallationStatusTransitionError extends ValidationError {
  constructor(from: string, to: string) {
    super(
      "INVALID_INSTALLATION_STATUS_TRANSITION",
      `Cannot transition Installation status from ${from} to ${to}.`,
    );
  }
}

export class InstallationNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("INSTALLATION_NOT_FOUND", `Installation not found: ${id}`);
  }
}

export class InstallationCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super("INSTALLATION_CODE_ALREADY_EXISTS", `Installation code already exists: ${code}`);
  }
}

export class InstallationCustomerNotFoundError extends NotFoundError {
  constructor(customerId: string) {
    super("CUSTOMER_NOT_FOUND", `Customer not found: ${customerId}`);
  }
}

export class InstallationCustomerNotActiveError extends ConflictError {
  constructor(customerId: string) {
    super("CUSTOMER_NOT_ACTIVE", `Customer ${customerId} is not ACTIVE.`);
  }
}

export class InstallationLicenseNotFoundError extends NotFoundError {
  constructor(licenseId: string) {
    super("LICENSE_NOT_FOUND", `License not found: ${licenseId}`);
  }
}

export class LicenseCustomerMismatchError extends ConflictError {
  constructor() {
    super("LICENSE_CUSTOMER_MISMATCH", "The license does not belong to the given customer.");
  }
}

export class LicenseNotUsableError extends ConflictError {
  constructor(licenseId: string) {
    super("LICENSE_NOT_USABLE", `License ${licenseId} is not currently usable.`);
  }
}

export class LicenseCapacityExceededError extends ConflictError {
  constructor(licenseId: string, maxInstallations: number) {
    super(
      "LICENSE_CAPACITY_EXCEEDED",
      `License ${licenseId} has reached its maximum of ${maxInstallations} installation(s).`,
    );
  }
}
