import type { Clock } from "@pos-cloud/shared-kernel";
import { InstallationCredentialId } from "./installation-credential-id";

export interface InstallationCredentialProps {
  id: InstallationCredentialId;
  installationId: string;
  secretHash: string;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface IssueInstallationCredentialInput {
  id: string;
  installationId: string;
  secretHash: string;
}

/**
 * A single permanent (until revoked) bearer credential for an Installation. The plaintext secret is
 * never stored - only `secretHash` (SHA-256) - so a database read alone never yields a usable
 * credential. No JWT, no TTL: the only way this credential stops working is `revoke()` or the
 * Installation's own status leaving ACTIVE - see InstallationAuthGuard and
 * docs/architecture/installation-enrollment.md#credential-flow. At most one non-revoked credential
 * may exist per Installation at a time - enforced structurally by migration #4's partial unique
 * index, not by this entity (which has no visibility into sibling rows).
 */
export class InstallationCredential {
  private constructor(private props: InstallationCredentialProps) {}

  static issue(input: IssueInstallationCredentialInput, clock: Clock): InstallationCredential {
    return new InstallationCredential({
      id: InstallationCredentialId.of(input.id),
      installationId: input.installationId,
      secretHash: input.secretHash,
      createdAt: clock.now(),
      revokedAt: null,
    });
  }

  /** Rehydrates an InstallationCredential from already-validated persisted state - no re-validation. */
  static reconstitute(props: InstallationCredentialProps): InstallationCredential {
    return new InstallationCredential(props);
  }

  isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  /**
   * Idempotent: revoking an already-revoked credential is a no-op, never throws - see
   * RevokeInstallationCredentialUseCase's own idempotent-204 contract.
   */
  revoke(clock: Clock): void {
    if (this.isRevoked()) {
      return;
    }
    this.props.revokedAt = clock.now();
  }

  get id(): InstallationCredentialId {
    return this.props.id;
  }

  get installationId(): string {
    return this.props.installationId;
  }

  get secretHash(): string {
    return this.props.secretHash;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }
}
