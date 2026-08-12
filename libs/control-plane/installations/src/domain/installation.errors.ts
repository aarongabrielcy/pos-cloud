import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@pos-cloud/shared-kernel";
import type { InstallationEnrollmentPurpose } from "./installation-enrollment-purpose";

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

/**
 * Raised by IssueInstallationEnrollmentUseCase (admin side only) when the Installation's current
 * status is not eligible for the requested purpose - see
 * domain/installation-enrollment-eligibility.ts. Never raised on the machine (enroll) side, where the
 * same condition instead produces the generic EnrollmentFailedError - see that error's own comment.
 */
export class InstallationNotEligibleForEnrollmentError extends ConflictError {
  constructor(installationId: string, status: string, purpose: InstallationEnrollmentPurpose) {
    super(
      "INSTALLATION_NOT_ELIGIBLE_FOR_ENROLLMENT",
      `Installation ${installationId} is ${status}, which is not eligible for ${purpose} enrollment.`,
    );
  }
}

/**
 * Single, generic, machine-facing 401 for every enrollment failure reason (malformed/unknown code,
 * wrong secret, expired, consumed, revoked, wrong Installation status for the code's purpose,
 * ineligible Customer, unusable License) - deliberately never distinguished to the caller, mirroring
 * InvalidAdminCredentialsError/InvalidRefreshTokenError's existing precedent. Internal diagnosis
 * never reaches the response body - see docs/architecture/installation-enrollment.md#error-contracts.
 */
export class EnrollmentFailedError extends UnauthorizedError {
  constructor() {
    super("ENROLLMENT_FAILED", "Enrollment failed.");
  }
}

/**
 * Single, generic, machine-facing 401 for every installation-credential authentication failure
 * (missing/malformed header, unknown credential id, wrong secret, revoked credential) - same
 * anti-enumeration reasoning as EnrollmentFailedError. SUSPENDED/DECOMMISSIONED are deliberately NOT
 * covered by this error - see InstallationSuspendedError/InstallationDecommissionedError, which are
 * specific 403s because the caller has already proven possession of a valid credential by that point.
 */
export class InstallationCredentialInvalidError extends UnauthorizedError {
  constructor() {
    super("INSTALLATION_CREDENTIAL_INVALID", "Invalid installation credential.");
  }
}

/**
 * Valid credential, but the Installation is currently SUSPENDED. 403 (not 401): the credential
 * itself is cryptographically valid - this is a permission-withdrawal, not an authentication
 * failure - see docs/architecture/installation-enrollment.md#auth-semantics.
 */
export class InstallationSuspendedError extends ForbiddenError {
  constructor() {
    super("INSTALLATION_SUSPENDED", "This installation is currently suspended.");
  }
}

/**
 * Valid credential, but the Installation is DECOMMISSIONED (terminal). 403 for the same reason as
 * InstallationSuspendedError.
 */
export class InstallationDecommissionedError extends ForbiddenError {
  constructor() {
    super("INSTALLATION_DECOMMISSIONED", "This installation has been decommissioned.");
  }
}
