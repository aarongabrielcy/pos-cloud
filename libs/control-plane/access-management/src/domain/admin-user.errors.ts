import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "@pos-cloud/shared-kernel";

export class InvalidAdminEmailError extends ValidationError {
  constructor() {
    super("INVALID_ADMIN_EMAIL", "Invalid admin email address.");
  }
}

export class InvalidAdminDisplayNameError extends ValidationError {
  constructor() {
    super("INVALID_ADMIN_DISPLAY_NAME", "Admin display name must be 1-150 characters after trim.");
  }
}

/**
 * Raised by the Password value object (domain-level policy: length only, see docs/architecture/
 * admin-authentication.md). Never constructed with the raw password in its message.
 */
export class InvalidAdminPasswordError extends ValidationError {
  constructor(reason: string) {
    super("INVALID_ADMIN_PASSWORD", `Invalid admin password: ${reason}`);
  }
}

export class AdminUserNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("ADMIN_USER_NOT_FOUND", `Admin user not found: ${id}`);
  }
}

export class AdminEmailAlreadyExistsError extends ConflictError {
  constructor() {
    super("ADMIN_EMAIL_ALREADY_EXISTS", "An admin user with this email already exists.");
  }
}

/**
 * Single, generic, public-facing 401 for every login-failure reason (unknown email, wrong
 * password, locked account, suspended account) - see AdminUser.recordFailedLogin's comment and
 * docs/architecture/admin-authentication.md#login-failure-handling. Never distinguish these to the
 * client.
 */
export class InvalidAdminCredentialsError extends UnauthorizedError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password.");
  }
}

/** Raised by BootstrapFirstAdminUseCase when at least one AdminUser already exists. */
export class AdminBootstrapAlreadyCompletedError extends ConflictError {
  constructor() {
    super("ADMIN_BOOTSTRAP_ALREADY_COMPLETED", "Admin bootstrap has already been completed.");
  }
}
