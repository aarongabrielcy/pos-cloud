import { Inject, Injectable } from "@nestjs/common";
import {
  AUDIT_RECORDER_PORT,
  type AuditRecorderPort,
  type AuditRequestContext,
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from "@pos-cloud/shared-kernel";
import { INSTALLATION_AUDIT_ACTIONS, INSTALLATION_AUDIT_RESOURCE_TYPE } from "../audit-actions";
import { InstallationCredential } from "../../domain/installation-credential";
import { InstallationEnrollmentId } from "../../domain/installation-enrollment-id";
import { isInstallationEligibleForEnrollment } from "../../domain/installation-enrollment-eligibility";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationStatus } from "../../domain/installation-status";
import { EnrollmentFailedError } from "../../domain/installation.errors";
import { formatOpaqueToken, parseOpaqueToken } from "../opaque-token-format";
import { CUSTOMER_READER_PORT, type CustomerReaderPort } from "../ports/customer-reader.port";
import {
  INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK,
  type InstallationEnrollmentConsumptionUnitOfWork,
} from "../ports/installation-enrollment-consumption-unit-of-work.port";
import {
  INSTALLATION_ENROLLMENT_REPOSITORY,
  type InstallationEnrollmentRepository,
} from "../ports/installation-enrollment-repository.port";
import {
  INSTALLATION_SECRET_GENERATOR,
  type InstallationSecretGeneratorPort,
} from "../ports/installation-secret-generator.port";
import { LICENSE_READER_PORT, type LicenseReaderPort } from "../ports/license-reader.port";

export interface EnrollInstallationCommand {
  readonly enrollmentCode: string;
}

export interface EnrollInstallationResult {
  readonly installationId: string;
  readonly credential: string;
}

/**
 * Machine-side enrollment consumption - the counterpart to IssueInstallationEnrollmentUseCase. Every
 * rejection path (malformed code, unknown enrollment, wrong secret, expired, consumed, revoked, wrong
 * Installation status for the code's purpose, ineligible Customer, unusable License) throws the same
 * EnrollmentFailedError (401 ENROLLMENT_FAILED) - see that error's own comment. Customer/License
 * eligibility is re-checked fresh here (not trusted from Installation-creation time or from
 * enrollment-issuance time) since either may have changed in the interim.
 *
 * Two-phase locking, see InstallationEnrollmentConsumptionUnitOfWork's own comment for why: phase 1
 * is a plain unlocked read of the enrollment row purely to learn which Installation to lock; phase 2
 * opens the transaction, locks the Installation first, then re-locks and re-verifies the same
 * enrollment row before any mutation.
 */
@Injectable()
export class EnrollInstallationUseCase {
  constructor(
    @Inject(INSTALLATION_ENROLLMENT_REPOSITORY)
    private readonly enrollments: InstallationEnrollmentRepository,
    @Inject(INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK)
    private readonly consumptionUnitOfWork: InstallationEnrollmentConsumptionUnitOfWork,
    @Inject(INSTALLATION_SECRET_GENERATOR)
    private readonly secretGenerator: InstallationSecretGeneratorPort,
    @Inject(CUSTOMER_READER_PORT) private readonly customerReader: CustomerReaderPort,
    @Inject(LICENSE_READER_PORT) private readonly licenseReader: LicenseReaderPort,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(AUDIT_RECORDER_PORT) private readonly auditRecorder: AuditRecorderPort,
  ) {}

  /**
   * No @CurrentInstallation() exists here (see AuditRequestContext's own comment) - the Installation
   * is still authenticating via the enrollment code, so only `requestContext.correlationId` is known
   * up front. The actor (actorType: INSTALLATION, actorId: the resolved installation.id) is built
   * internally, only once the transaction below has legitimately resolved it - never from anything
   * the caller supplies (see CLOUD-01C-D section 19).
   */
  async execute(
    command: EnrollInstallationCommand,
    requestContext: AuditRequestContext,
  ): Promise<EnrollInstallationResult> {
    const parsed = parseOpaqueToken(command.enrollmentCode);
    if (!parsed) {
      throw new EnrollmentFailedError();
    }

    // Phase 1: unlocked, informational only - discover which Installation to lock.
    const discovered = await this.enrollments.findById(InstallationEnrollmentId.of(parsed.id));
    if (!discovered) {
      throw new EnrollmentFailedError();
    }
    const installationId = discovered.installationId;

    const outcome = await this.consumptionUnitOfWork.runExclusive(installationId, async (ctx) => {
      const installation = await ctx.findInstallationForUpdate(installationId);
      if (!installation) {
        throw new EnrollmentFailedError();
      }

      // Phase 2: locked, authoritative re-read - nothing from phase 1 is trusted beyond the id.
      const enrollment = await ctx.findEnrollmentForUpdate(parsed.id);
      if (!enrollment) {
        throw new EnrollmentFailedError();
      }

      if (!this.secretGenerator.secretMatchesHash(parsed.secret, enrollment.codeHash)) {
        throw new EnrollmentFailedError();
      }

      if (!enrollment.isConsumable(this.clock.now())) {
        throw new EnrollmentFailedError();
      }

      if (!isInstallationEligibleForEnrollment(installation.status, enrollment.purpose)) {
        throw new EnrollmentFailedError();
      }

      const customer = await this.customerReader.findCustomerSummary(installation.customerId);
      if (!customer || !customer.active) {
        throw new EnrollmentFailedError();
      }

      const license = await this.licenseReader.findLicenseSummary(installation.licenseId);
      if (!license || !license.usable) {
        throw new EnrollmentFailedError();
      }

      enrollment.markConsumed(this.clock);
      await ctx.saveEnrollment(enrollment);

      if (
        enrollment.purpose === InstallationEnrollmentPurpose.INITIAL &&
        installation.status === InstallationStatus.PENDING
      ) {
        installation.activate(this.clock);
        await ctx.saveInstallation(installation);
      }

      const existingCredential = await ctx.findActiveCredentialByInstallationId(installationId);
      if (existingCredential) {
        existingCredential.revoke(this.clock);
        await ctx.saveCredential(existingCredential);
      }

      const secret = this.secretGenerator.generateSecret();
      const credential = InstallationCredential.issue(
        {
          id: this.idGenerator.next(),
          installationId,
          secretHash: this.secretGenerator.hashSecret(secret),
        },
        this.clock,
      );
      await ctx.saveCredential(credential);

      return {
        installationId,
        credential: formatOpaqueToken(credential.id.toString(), secret),
        purpose: enrollment.purpose,
        resultingStatus: installation.status,
      };
    });

    // Recorded only after the transaction has committed (runExclusive resolved) - never for any of
    // the EnrollmentFailedError rejection paths above, which all throw from inside the callback
    // before this line is ever reached.
    await this.auditRecorder.record({
      actor: {
        actorType: "INSTALLATION",
        actorId: outcome.installationId,
        correlationId: requestContext.correlationId,
      },
      action: INSTALLATION_AUDIT_ACTIONS.ENROLLMENT_CONSUMED,
      resourceType: INSTALLATION_AUDIT_RESOURCE_TYPE,
      resourceId: outcome.installationId,
      metadata: { purpose: outcome.purpose, resultingStatus: outcome.resultingStatus },
    });

    return { installationId: outcome.installationId, credential: outcome.credential };
  }
}
