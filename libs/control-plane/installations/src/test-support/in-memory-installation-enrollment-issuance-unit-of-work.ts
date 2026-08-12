import type {
  InstallationEnrollmentIssuanceContext,
  InstallationEnrollmentIssuanceUnitOfWork,
} from "../application/ports/installation-enrollment-issuance-unit-of-work.port";
import type { Installation } from "../domain/installation";
import type { InstallationEnrollment } from "../domain/installation-enrollment";

/**
 * Test double for InstallationEnrollmentIssuanceUnitOfWork - never used in production code. Does not
 * simulate real row locking/serialization (no fake in this repository does - see
 * TypeOrmAdminSessionUnitOfWork's own spec for why real Postgres locking is out of scope for
 * automated tests here); it exists purely to let use-case tests exercise the full orchestration
 * sequence against shared, mutable in-memory state.
 */
export class InMemoryInstallationEnrollmentIssuanceUnitOfWork implements InstallationEnrollmentIssuanceUnitOfWork {
  constructor(
    private readonly installations: Map<string, Installation>,
    private readonly enrollments: Map<string, InstallationEnrollment>,
  ) {}

  async runExclusive<T>(
    _installationId: string,
    fn: (ctx: InstallationEnrollmentIssuanceContext) => Promise<T>,
  ): Promise<T> {
    const ctx: InstallationEnrollmentIssuanceContext = {
      findInstallationForUpdate: async (installationId) =>
        this.installations.get(installationId) ?? null,
      findOpenEnrollmentByInstallationId: async (installationId) => {
        for (const enrollment of this.enrollments.values()) {
          if (
            enrollment.installationId === installationId &&
            enrollment.consumedAt === null &&
            enrollment.revokedAt === null
          ) {
            return enrollment;
          }
        }
        return null;
      },
      saveEnrollment: async (enrollment) => {
        this.enrollments.set(enrollment.id.toString(), enrollment);
      },
    };
    return fn(ctx);
  }
}
