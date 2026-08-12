import type { Clock } from "@pos-cloud/shared-kernel";
import { InstallationEnrollmentId } from "./installation-enrollment-id";
import type { InstallationEnrollmentPurpose } from "./installation-enrollment-purpose";

export interface InstallationEnrollmentProps {
  id: InstallationEnrollmentId;
  installationId: string;
  purpose: InstallationEnrollmentPurpose;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}

export interface IssueInstallationEnrollmentInput {
  id: string;
  installationId: string;
  purpose: InstallationEnrollmentPurpose;
  codeHash: string;
  ttlSeconds: number;
}

/**
 * A single one-time enrollment code issuance for an Installation. The plaintext secret is never
 * stored - only `codeHash` (SHA-256, see InstallationSecretGeneratorPort) - so a database read alone
 * never yields a usable code. "Open" (still capable of being consumed) means `consumedAt === null &&
 * revokedAt === null`, regardless of `expiresAt` - see the partial unique index in migration #4,
 * which uses the same predicate to enforce at most one open enrollment per Installation at the
 * database level. Business logic (secret comparison, status eligibility, fresh Customer/License
 * checks) deliberately lives in EnrollInstallationUseCase, not here - this entity only guards its own
 * timestamp invariants, mirroring AdminSession's split between "pure predicates here" and
 * "orchestration + external validation in the use case".
 */
export class InstallationEnrollment {
  private constructor(private props: InstallationEnrollmentProps) {}

  static issue(input: IssueInstallationEnrollmentInput, clock: Clock): InstallationEnrollment {
    const now = clock.now();

    return new InstallationEnrollment({
      id: InstallationEnrollmentId.of(input.id),
      installationId: input.installationId,
      purpose: input.purpose,
      codeHash: input.codeHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
      consumedAt: null,
      revokedAt: null,
    });
  }

  /** Rehydrates an InstallationEnrollment from already-validated persisted state - no re-validation. */
  static reconstitute(props: InstallationEnrollmentProps): InstallationEnrollment {
    return new InstallationEnrollment(props);
  }

  isConsumed(): boolean {
    return this.props.consumedAt !== null;
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this.props.expiresAt <= now;
  }

  /** True only when this code may still be exchanged for activation/a credential. */
  isConsumable(now: Date): boolean {
    return !this.isConsumed() && !this.isRevoked() && !this.isExpired(now);
  }

  /**
   * Unconditional - the caller (EnrollInstallationUseCase) has already checked `isConsumable` under
   * a row lock before calling this; this method does not re-validate or throw, matching
   * AdminSession.touch()/revoke()'s own unconditional shape.
   */
  markConsumed(clock: Clock): void {
    this.props.consumedAt = clock.now();
  }

  /** Unconditional and effectively idempotent in intent - callers only ever revoke an open enrollment once. */
  revoke(clock: Clock): void {
    this.props.revokedAt = clock.now();
  }

  get id(): InstallationEnrollmentId {
    return this.props.id;
  }

  get installationId(): string {
    return this.props.installationId;
  }

  get purpose(): InstallationEnrollmentPurpose {
    return this.props.purpose;
  }

  get codeHash(): string {
    return this.props.codeHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get consumedAt(): Date | null {
    return this.props.consumedAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
}
