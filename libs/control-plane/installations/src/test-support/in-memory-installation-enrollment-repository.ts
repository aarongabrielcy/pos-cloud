import type { InstallationEnrollmentRepository } from "../application/ports/installation-enrollment-repository.port";
import type { InstallationEnrollment } from "../domain/installation-enrollment";
import type { InstallationEnrollmentId } from "../domain/installation-enrollment-id";

/** Test double for InstallationEnrollmentRepository - never used in production code. */
export class InMemoryInstallationEnrollmentRepository implements InstallationEnrollmentRepository {
  constructor(private readonly byId: Map<string, InstallationEnrollment>) {}

  async findById(id: InstallationEnrollmentId): Promise<InstallationEnrollment | null> {
    return this.byId.get(id.toString()) ?? null;
  }
}
