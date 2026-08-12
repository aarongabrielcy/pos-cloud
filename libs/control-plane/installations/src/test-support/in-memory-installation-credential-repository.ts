import type { InstallationCredentialRepository } from "../application/ports/installation-credential-repository.port";
import type { InstallationCredential } from "../domain/installation-credential";

/** Test double for InstallationCredentialRepository - never used in production code. */
export class InMemoryInstallationCredentialRepository implements InstallationCredentialRepository {
  constructor(private readonly byId: Map<string, InstallationCredential>) {}

  async findActiveByInstallationId(installationId: string): Promise<InstallationCredential | null> {
    for (const credential of this.byId.values()) {
      if (credential.installationId === installationId && !credential.isRevoked()) {
        return credential;
      }
    }
    return null;
  }

  async save(credential: InstallationCredential): Promise<void> {
    this.byId.set(credential.id.toString(), credential);
  }
}
