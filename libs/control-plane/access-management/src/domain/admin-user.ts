import type { Clock } from "@pos-cloud/shared-kernel";
import { AdminUserId } from "./admin-user-id";
import { AdminUserStatus } from "./admin-user-status";
import { InvalidAdminDisplayNameError } from "./admin-user.errors";
import { Email } from "./email";

/** 5 consecutive failed attempts locks the account for 15 minutes - see docs/architecture/admin-authentication.md#login-failure--lockout. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface AdminUserProps {
  id: AdminUserId;
  email: Email;
  displayName: string;
  passwordHash: string;
  status: AdminUserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminUserInput {
  id: string;
  email: string;
  displayName: string;
  /** Already hashed - Domain never hashes a password itself (see PasswordHasherPort, application layer). */
  passwordHash: string;
}

export class AdminUser {
  private constructor(private props: AdminUserProps) {}

  static create(input: CreateAdminUserInput, clock: Clock): AdminUser {
    const now = clock.now();

    return new AdminUser({
      id: AdminUserId.of(input.id),
      email: Email.create(input.email),
      displayName: validateDisplayName(input.displayName),
      passwordHash: input.passwordHash,
      status: AdminUserStatus.ACTIVE,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Rehydrates an AdminUser from already-validated persisted state - no re-validation. */
  static reconstitute(props: AdminUserProps): AdminUser {
    return new AdminUser(props);
  }

  isLocked(now: Date): boolean {
    return this.props.lockedUntil !== null && this.props.lockedUntil > now;
  }

  /** ACTIVE and not currently locked - the only state from which a login attempt may proceed. */
  canAttemptLogin(now: Date): boolean {
    return this.props.status === AdminUserStatus.ACTIVE && !this.isLocked(now);
  }

  /**
   * Increments the failed-attempt counter, locking the account for LOCK_DURATION_MS once it
   * reaches MAX_FAILED_LOGIN_ATTEMPTS. Callers must gate this behind `canAttemptLogin` first - it
   * is a fixed lock window from the triggering failure, not a rolling one, so it must not be called
   * again while the account is already locked (that would push lockedUntil further out on every
   * retry).
   */
  recordFailedLogin(clock: Clock): void {
    const now = clock.now();
    this.props.failedLoginAttempts += 1;
    if (this.props.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      this.props.lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    }
    this.props.updatedAt = now;
  }

  recordSuccessfulLogin(clock: Clock): void {
    const now = clock.now();
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = now;
    this.props.updatedAt = now;
  }

  get id(): AdminUserId {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get displayName(): string {
    return this.props.displayName;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get status(): AdminUserStatus {
    return this.props.status;
  }

  get failedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  get lockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  get lastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function validateDisplayName(raw: string): string {
  const normalized = raw.trim();
  if (normalized.length < 1 || normalized.length > 150) {
    throw new InvalidAdminDisplayNameError();
  }
  return normalized;
}
