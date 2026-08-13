import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_RECORDER_PORT,
  type AuditActorContext,
  type AuditRecorderPort,
  CLOCK,
  type Clock,
} from "@pos-cloud/shared-kernel";
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { InstallationId } from "../../domain/installation-id";
import {
  INSTALLATION_REPOSITORY,
  type InstallationRepository,
} from "../../domain/installation-repository.port";
import { InstallationNotFoundError } from "../../domain/installation.errors";
import {
  INSTALLATION_CREDENTIAL_REPOSITORY,
  type InstallationCredentialRepository,
} from "../ports/installation-credential-repository.port";

export interface RevokeInstallationCredentialCommand {
  readonly installationId: string;
}

/**
 * Idempotent: revoking an Installation with no active credential still succeeds (204) - see
 * InstallationCredential.revoke's own comment. Never changes Installation.status, never deletes the
 * row - only marks `revokedAt`. Recovery back online is a separate admin action
 * (IssueInstallationEnrollmentUseCase with purpose RECOVERY) - see docs/architecture/
 * installation-enrollment.md#credential-flow. Only audited when a credential was actually revoked -
 * the no-op branch (no active credential) records nothing, since nothing happened.
 */
@Injectable()
export class RevokeInstallationCredentialUseCase {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
    @Inject(INSTALLATION_CREDENTIAL_REPOSITORY)
    private readonly credentials: InstallationCredentialRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(
    command: RevokeInstallationCredentialCommand,
    actor: AuditActorContext,
  ): Promise<void> {
    const installation = await this.installations.findById(
      InstallationId.of(command.installationId),
    );
    if (!installation) {
      throw new InstallationNotFoundError(command.installationId);
    }

    const credential = await this.credentials.findActiveByInstallationId(command.installationId);
    if (!credential) {
      return;
    }

    credential.revoke(this.clock);
    await this.credentials.save(credential);

    await this.auditRecorder.record({
      actor,
      action: INSTALLATION_AUDIT_ACTIONS.CREDENTIAL_REVOKED,
      resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
      resourceId: command.installationId,
      metadata: {},
    });
  }
}
