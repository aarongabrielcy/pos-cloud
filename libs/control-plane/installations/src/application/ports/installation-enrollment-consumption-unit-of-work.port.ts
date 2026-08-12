import type { Installation } from "../../domain/installation";
import type { InstallationCredential } from "../../domain/installation-credential";
import type { InstallationEnrollment } from "../../domain/installation-enrollment";

/**
 * Real atomicity for consuming an enrollment code (see EnrollInstallationUseCase): one PostgreSQL
 * transaction serializing enrollment consumption, activation (INITIAL only), and credential
 * replacement together, keyed by Installation id.
 *
 * Lock order is deliberately Installation-first, then the enrollment row
 * (`findInstallationForUpdate` before `findEnrollmentForUpdate`) - the brief's own flow narrative
 * lists "SELECT FOR UPDATE enrollment" before "lock Installation", but locking in that literal order
 * here would make this unit-of-work's lock order the *reverse* of
 * InstallationEnrollmentIssuanceUnitOfWork's (Installation-first). Two transactions taking row locks
 * in opposite orders on the same pair of rows is a textbook lock-order deadlock: a concurrent issue
 * (holding the Installation lock, waiting on the enrollment row to revoke it) and a concurrent consume
 * of that same enrollment (holding the enrollment lock, waiting on the Installation row) can each
 * block on the other, which PostgreSQL resolves by aborting one side with a `deadlock_detected`
 * error - not silent corruption, but an unnecessary 500 for a case that's fully avoidable. Locking
 * Installation first in both unit-of-work implementations removes this deadlock class entirely, with
 * no change to either flow's actual business semantics - the enrollment row is still locked and
 * re-verified under the transaction before any mutation; only the acquisition order changed.
 * EnrollInstallationUseCase performs one earlier, unlocked, informational read
 * (InstallationEnrollmentRepository.findById) purely to learn which Installation to lock first.
 */
export interface InstallationEnrollmentConsumptionContext {
  findInstallationForUpdate(installationId: string): Promise<Installation | null>;
  findEnrollmentForUpdate(enrollmentId: string): Promise<InstallationEnrollment | null>;
  saveInstallation(installation: Installation): Promise<void>;
  saveEnrollment(enrollment: InstallationEnrollment): Promise<void>;
  findActiveCredentialByInstallationId(
    installationId: string,
  ): Promise<InstallationCredential | null>;
  saveCredential(credential: InstallationCredential): Promise<void>;
}

export interface InstallationEnrollmentConsumptionUnitOfWork {
  runExclusive<T>(
    installationId: string,
    fn: (ctx: InstallationEnrollmentConsumptionContext) => Promise<T>,
  ): Promise<T>;
}

export const INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK = Symbol(
  "INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK",
);
