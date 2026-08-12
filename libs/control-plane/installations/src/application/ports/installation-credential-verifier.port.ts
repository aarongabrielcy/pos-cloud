import type { InstallationStatus } from "../../domain/installation-status";

export interface InstallationCredentialVerificationResult {
  readonly installationId: string;
  readonly installationStatus: InstallationStatus;
}

/**
 * Verifies a presented `<credentialId>.<secret>` pair against `installation_credentials` joined with
 * the owning `installations` row, in a single indexed query - the direct structural twin of
 * access-management's TypeOrmPermissionResolverAdapter (one query, no N+1, no Redis). Returns `null`
 * for every "invalid credential" outcome (unknown id, wrong secret, revoked) - InstallationAuthGuard
 * collapses all of these into the single generic InstallationCredentialInvalidError, never
 * distinguishing them to the caller. When the credential itself is valid, the live Installation
 * status is returned so the guard (not this port) decides ACTIVE/SUSPENDED/DECOMMISSIONED handling -
 * see docs/architecture/installation-enrollment.md#installation-auth-contract.
 */
export interface InstallationCredentialVerifierPort {
  verify(
    credentialId: string,
    secret: string,
  ): Promise<InstallationCredentialVerificationResult | null>;
}

export const INSTALLATION_CREDENTIAL_VERIFIER = Symbol("INSTALLATION_CREDENTIAL_VERIFIER");
