import type { InstallationCredential } from "../../domain/installation-credential";

/**
 * Plain (non-transactional) credential persistence for RevokeInstallationCredentialUseCase. No row
 * locking needed - revocation is idempotent/commutative (see InstallationCredential.revoke), so two
 * concurrent revoke requests racing is harmless even without serialization.
 */
export interface InstallationCredentialRepository {
  findActiveByInstallationId(installationId: string): Promise<InstallationCredential | null>;
  save(credential: InstallationCredential): Promise<void>;
}

export const INSTALLATION_CREDENTIAL_REPOSITORY = Symbol("INSTALLATION_CREDENTIAL_REPOSITORY");
