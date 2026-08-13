// Public API of @pos-cloud/installations.
// Deliberately excluded: infrastructure/persistence and presentation/http internals.

export { InstallationsModule } from "./installations.module";

export { CreateInstallationUseCase } from "./application/use-cases/create-installation.use-case";
export type { CreateInstallationCommand } from "./application/use-cases/create-installation.use-case";
export { GetInstallationByIdUseCase } from "./application/use-cases/get-installation-by-id.use-case";
export { ListInstallationsUseCase } from "./application/use-cases/list-installations.use-case";
export type { ListInstallationsQuery } from "./application/use-cases/list-installations.use-case";
export { ChangeInstallationStatusUseCase } from "./application/use-cases/change-installation-status.use-case";
export type { ChangeInstallationStatusCommand } from "./application/use-cases/change-installation-status.use-case";
export { IssueInstallationEnrollmentUseCase } from "./application/use-cases/issue-installation-enrollment.use-case";
export type {
  IssueInstallationEnrollmentCommand,
  IssueInstallationEnrollmentResult,
} from "./application/use-cases/issue-installation-enrollment.use-case";
export { EnrollInstallationUseCase } from "./application/use-cases/enroll-installation.use-case";
export type {
  EnrollInstallationCommand,
  EnrollInstallationResult,
} from "./application/use-cases/enroll-installation.use-case";
export { RevokeInstallationCredentialUseCase } from "./application/use-cases/revoke-installation-credential.use-case";
export type { RevokeInstallationCredentialCommand } from "./application/use-cases/revoke-installation-credential.use-case";
export { RecordInstallationHeartbeatUseCase } from "./application/use-cases/record-installation-heartbeat.use-case";
export type { RecordInstallationHeartbeatCommand } from "./application/use-cases/record-installation-heartbeat.use-case";
export { GetInstallationHealthUseCase } from "./application/use-cases/get-installation-health.use-case";
export type { InstallationHealthDetail } from "./application/use-cases/get-installation-health.use-case";
export type { InstallationListItemWithHealth } from "./application/use-cases/list-installations.use-case";

export {
  CUSTOMER_READER_PORT,
  type CustomerReaderPort,
  type CustomerSummary,
} from "./application/ports/customer-reader.port";
export {
  LICENSE_READER_PORT,
  type LicenseReaderPort,
  type LicenseSummary,
} from "./application/ports/license-reader.port";

export type { Installation } from "./domain/installation";
export { InstallationStatus } from "./domain/installation-status";
export { InstallationHealthStatus } from "./domain/installation-health-status";
export { Platform } from "./domain/platform";
export { InstallationEnrollmentPurpose } from "./domain/installation-enrollment-purpose";
export * from "./domain/installation.errors";

export { InstallationAuthGuard } from "./presentation/http/guards/installation-auth.guard";
// INSTALLATION_CREDENTIAL_VERIFIER/InstallationCredentialVerifierPort are exported solely so
// composition-root-level HTTP tests (apps/api) can `.overrideProvider(INSTALLATION_CREDENTIAL_VERIFIER)`
// with a fake and drive the real InstallationAuthGuard end-to-end without a PostgreSQL connection -
// the same reason access-management exports PERMISSION_RESOLVER. Never meant for runtime business
// logic outside this package.
export {
  INSTALLATION_CREDENTIAL_VERIFIER,
  type InstallationCredentialVerifierPort,
  type InstallationCredentialVerificationResult,
} from "./application/ports/installation-credential-verifier.port";
// Same reasoning as INSTALLATION_CREDENTIAL_VERIFIER above - lets apps/api HTTP tests override the
// health read/write ports with fakes instead of constructing the real TypeORM adapter.
export {
  INSTALLATION_HEALTH_WRITER,
  type InstallationHealthWriterPort,
} from "./application/ports/installation-health-writer.port";
export {
  INSTALLATION_HEALTH_READER,
  type InstallationHealthReaderPort,
  type InstallationHealthSnapshot,
} from "./application/ports/installation-health-reader.port";
export { InstallationEnrollment } from "./presentation/http/decorators/installation-enrollment.decorator";
export { InstallationAuthenticated } from "./presentation/http/decorators/installation-authenticated.decorator";
export { CurrentInstallation } from "./presentation/http/decorators/current-installation.decorator";
export type { CurrentInstallationPrincipal } from "./presentation/http/current-installation-principal";
