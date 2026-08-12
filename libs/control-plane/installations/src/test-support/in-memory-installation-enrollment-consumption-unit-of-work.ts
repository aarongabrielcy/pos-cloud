import type {
  InstallationEnrollmentConsumptionContext,
  InstallationEnrollmentConsumptionUnitOfWork,
} from "../application/ports/installation-enrollment-consumption-unit-of-work.port";
import type { Installation } from "../domain/installation";
import type { InstallationCredential } from "../domain/installation-credential";
import type { InstallationEnrollment } from "../domain/installation-enrollment";

/**
 * Test double for InstallationEnrollmentConsumptionUnitOfWork - never used in production code. Same
 * "no real locking simulated" caveat as InMemoryInstallationEnrollmentIssuanceUnitOfWork.
 */
export class InMemoryInstallationEnrollmentConsumptionUnitOfWork implements InstallationEnrollmentConsumptionUnitOfWork {
  constructor(
    private readonly installations: Map<string, Installation>,
    private readonly enrollments: Map<string, InstallationEnrollment>,
    private readonly credentials: Map<string, InstallationCredential>,
  ) {}

  async runExclusive<T>(
    _installationId: string,
    fn: (ctx: InstallationEnrollmentConsumptionContext) => Promise<T>,
  ): Promise<T> {
    const ctx: InstallationEnrollmentConsumptionContext = {
      findInstallationForUpdate: async (installationId) =>
        this.installations.get(installationId) ?? null,
      findEnrollmentForUpdate: async (enrollmentId) => this.enrollments.get(enrollmentId) ?? null,
      saveInstallation: async (installation) => {
        this.installations.set(installation.id.toString(), installation);
      },
      saveEnrollment: async (enrollment) => {
        this.enrollments.set(enrollment.id.toString(), enrollment);
      },
      findActiveCredentialByInstallationId: async (installationId) => {
        for (const credential of this.credentials.values()) {
          if (credential.installationId === installationId && !credential.isRevoked()) {
            return credential;
          }
        }
        return null;
      },
      saveCredential: async (credential) => {
        this.credentials.set(credential.id.toString(), credential);
      },
    };
    return fn(ctx);
  }
}
