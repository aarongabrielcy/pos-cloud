import type { InstallationEnrollment } from "../../domain/installation-enrollment";
import type { InstallationEnrollmentId } from "../../domain/installation-enrollment-id";

/**
 * Plain (non-transactional, unlocked) enrollment lookup - used by EnrollInstallationUseCase's own
 * first step, to discover which Installation a presented enrollment code belongs to *before* opening
 * the locked consumption transaction (see InstallationEnrollmentConsumptionUnitOfWork). Locking
 * happens only inside the two unit-of-work ports below, never through this repository.
 */
export interface InstallationEnrollmentRepository {
  findById(id: InstallationEnrollmentId): Promise<InstallationEnrollment | null>;
}

export const INSTALLATION_ENROLLMENT_REPOSITORY = Symbol("INSTALLATION_ENROLLMENT_REPOSITORY");
