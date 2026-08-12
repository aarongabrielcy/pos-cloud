import { InstallationEnrollmentPurpose } from "./installation-enrollment-purpose";
import { InstallationStatus } from "./installation-status";

/**
 * Single source of truth for which Installation statuses may receive each enrollment purpose -
 * shared by the admin-side issuance use case (which rejects with a specific 409) and
 * EnrollInstallationUseCase's own fresh re-check at consumption time (which rejects with the
 * generic 401 ENROLLMENT_FAILED - the status may have changed between issuance and consumption).
 * INITIAL only ever starts from PENDING - real activation is `Installation.activate()`, never an
 * admin transition. RECOVERY deliberately excludes PENDING (nothing to recover before the first
 * enrollment ever happened) and DECOMMISSIONED (terminal, no path back).
 */
const ELIGIBLE_STATUSES: Readonly<
  Record<InstallationEnrollmentPurpose, readonly InstallationStatus[]>
> = {
  [InstallationEnrollmentPurpose.INITIAL]: [InstallationStatus.PENDING],
  [InstallationEnrollmentPurpose.RECOVERY]: [
    InstallationStatus.ACTIVE,
    InstallationStatus.SUSPENDED,
  ],
};

export function isInstallationEligibleForEnrollment(
  status: InstallationStatus,
  purpose: InstallationEnrollmentPurpose,
): boolean {
  return ELIGIBLE_STATUSES[purpose].includes(status);
}
