import type { Installation } from "../../domain/installation";
import type { InstallationEnrollment } from "../../domain/installation-enrollment";

/**
 * Real atomicity for issuing an enrollment code (both INITIAL and RECOVERY - see
 * IssueInstallationEnrollmentUseCase): one PostgreSQL transaction, with the target Installation row
 * locked `SELECT ... FOR UPDATE` first (`findInstallationForUpdate`) - always the first thing the use
 * case does inside this transaction - so two admins issuing enrollment for the same Installation at
 * the same time serialize instead of racing (see docs/architecture/
 * installation-enrollment.md#concurrency). Locking the Installation *before* touching any enrollment
 * row (rather than the other way around) keeps this unit-of-work's lock order consistent with
 * InstallationEnrollmentConsumptionUnitOfWork's, which avoids a lock-order deadlock between a
 * concurrent issue and a concurrent consume on the same Installation.
 */
export interface InstallationEnrollmentIssuanceContext {
  findInstallationForUpdate(installationId: string): Promise<Installation | null>;
  /** The single open (consumedAt IS NULL AND revokedAt IS NULL) enrollment for this Installation, if any. */
  findOpenEnrollmentByInstallationId(
    installationId: string,
  ): Promise<InstallationEnrollment | null>;
  saveEnrollment(enrollment: InstallationEnrollment): Promise<void>;
}

export interface InstallationEnrollmentIssuanceUnitOfWork {
  runExclusive<T>(
    installationId: string,
    fn: (ctx: InstallationEnrollmentIssuanceContext) => Promise<T>,
  ): Promise<T>;
}

export const INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK = Symbol(
  "INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK",
);
