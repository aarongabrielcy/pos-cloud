import type {
  InstallationCreationContext,
  InstallationCreationUnitOfWork,
} from "../application/ports/installation-creation-unit-of-work.port";
import type { InstallationRepository } from "../domain/installation-repository.port";

/**
 * Test double for InstallationCreationUnitOfWork - never used in production code. Delegates
 * straight to an InMemoryInstallationRepository instance, so existing sequential use-case tests
 * (and their direct repository assertions) keep working unchanged. Does not simulate real
 * cross-request row/advisory locking - see
 * typeorm-installation-creation-unit-of-work.concurrency.spec.ts for the test that actually proves
 * concurrent-request serialization, mirroring TypeOrmAdminSessionUnitOfWork's own precedent for why
 * a smart fake (not a real DB connection) is this repository's established way of proving
 * concurrency-sensitive logic.
 */
export class InMemoryInstallationCreationUnitOfWork implements InstallationCreationUnitOfWork {
  constructor(private readonly repository: InstallationRepository) {}

  async runExclusiveForLicense<T>(
    _licenseId: string,
    fn: (ctx: InstallationCreationContext) => Promise<T>,
  ): Promise<T> {
    const ctx: InstallationCreationContext = {
      countNonDecommissionedByLicense: (licenseId) =>
        this.repository.countNonDecommissionedByLicense(licenseId),
      findInstallationByCode: (code) => this.repository.findByCode(code),
      saveInstallation: (installation) => this.repository.save(installation),
    };
    return fn(ctx);
  }
}
