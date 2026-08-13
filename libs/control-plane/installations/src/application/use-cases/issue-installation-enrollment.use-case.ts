import { Inject, Injectable } from "@nestjs/common";
import { INSTALLATION_AUTH_CONFIG, type InstallationAuthConfig } from "@pos-cloud/config";
import {
  AUDIT_RECORDER_PORT,
  type AuditActorContext,
  type AuditRecorderPort,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from "@pos-cloud/shared-kernel";
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { formatOpaqueToken } from "../opaque-token-format";
import {
  INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK,
  type InstallationEnrollmentIssuanceUnitOfWork,
} from "../ports/installation-enrollment-issuance-unit-of-work.port";
import {
  INSTALLATION_SECRET_GENERATOR,
  type InstallationSecretGeneratorPort,
} from "../ports/installation-secret-generator.port";
import { InstallationEnrollment } from "../../domain/installation-enrollment";
import { isInstallationEligibleForEnrollment } from "../../domain/installation-enrollment-eligibility";
import type { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import {
  InstallationNotEligibleForEnrollmentError,
  InstallationNotFoundError,
} from "../../domain/installation.errors";

export interface IssueInstallationEnrollmentCommand {
  readonly installationId: string;
  readonly purpose: InstallationEnrollmentPurpose;
}

export interface IssueInstallationEnrollmentResult {
  readonly installationId: string;
  readonly enrollmentCode: string;
  readonly expiresAt: Date;
}

/**
 * Admin-side issuance, shared by both the INITIAL endpoint (`installations.enrollment.manage`,
 * PENDING only) and the RECOVERY endpoint (`installations.credentials.manage`, ACTIVE/SUSPENDED
 * only) - the two flows are mechanically identical (lock Installation, validate eligibility for the
 * given purpose, revoke any still-open prior enrollment, issue a new one); only the permission
 * gating the calling endpoint and the `purpose` passed in differ, and permission gating belongs at
 * the presentation layer (`@RequirePermissions`), not duplicated across two near-identical use case
 * classes - see docs/architecture/installation-enrollment.md#initial-vs-recovery.
 *
 * Serialized per Installation via InstallationEnrollmentIssuanceUnitOfWork - see that port's own
 * comment for why (CORRECTION #2: two admins issuing enrollment for the same Installation at the
 * same time must not both succeed with two simultaneously-open codes).
 */
@Injectable()
export class IssueInstallationEnrollmentUseCase {
  constructor(
    @Inject(INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK)
    private readonly unitOfWork: InstallationEnrollmentIssuanceUnitOfWork,
    @Inject(INSTALLATION_SECRET_GENERATOR)
    private readonly secretGenerator: InstallationSecretGeneratorPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(INSTALLATION_AUTH_CONFIG)
    private readonly installationAuthConfig: InstallationAuthConfig,
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  async execute(
    command: IssueInstallationEnrollmentCommand,
    actor: AuditActorContext,
  ): Promise<IssueInstallationEnrollmentResult> {
    const result = await this.unitOfWork.runExclusive(command.installationId, async (ctx) => {
      const installation = await ctx.findInstallationForUpdate(command.installationId);
      if (!installation) {
        throw new InstallationNotFoundError(command.installationId);
      }

      if (!isInstallationEligibleForEnrollment(installation.status, command.purpose)) {
        throw new InstallationNotEligibleForEnrollmentError(
          command.installationId,
          installation.status,
          command.purpose,
        );
      }

      const priorOpenEnrollment = await ctx.findOpenEnrollmentByInstallationId(
        command.installationId,
      );
      if (priorOpenEnrollment) {
        priorOpenEnrollment.revoke(this.clock);
        await ctx.saveEnrollment(priorOpenEnrollment);
      }

      const secret = this.secretGenerator.generateSecret();
      const enrollment = InstallationEnrollment.issue(
        {
          id: this.idGenerator.next(),
          installationId: command.installationId,
          purpose: command.purpose,
          codeHash: this.secretGenerator.hashSecret(secret),
          ttlSeconds: this.installationAuthConfig.enrollmentCodeTtlSeconds,
        },
        this.clock,
      );
      await ctx.saveEnrollment(enrollment);

      return {
        installationId: command.installationId,
        enrollmentCode: formatOpaqueToken(enrollment.id.toString(), secret),
        expiresAt: enrollment.expiresAt,
      };
    });

    // Recorded only after the transaction has committed (runExclusive resolved) - never for a
    // rolled-back attempt (e.g. InstallationNotEligibleForEnrollmentError, thrown from inside the
    // callback, propagates out of runExclusive before this line is ever reached).
    await this.auditRecorder.record({
      actor,
      action: INSTALLATION_AUDIT_ACTIONS.ENROLLMENT_ISSUED,
      resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
      resourceId: command.installationId,
      metadata: { purpose: command.purpose },
    });

    return result;
  }
}
