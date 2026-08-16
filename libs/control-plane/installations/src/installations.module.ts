import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ChangeInstallationStatusUseCase } from "./application/use-cases/change-installation-status.use-case";
import { CreateInstallationUseCase } from "./application/use-cases/create-installation.use-case";
import { EnrollInstallationUseCase } from "./application/use-cases/enroll-installation.use-case";
import { GetCustomerSummariesUseCase } from "./application/use-cases/get-customer-summaries.use-case";
import { GetInstallationByIdUseCase } from "./application/use-cases/get-installation-by-id.use-case";
import { GetInstallationHealthUseCase } from "./application/use-cases/get-installation-health.use-case";
import { GetLicenseSummariesUseCase } from "./application/use-cases/get-license-summaries.use-case";
import { IssueInstallationEnrollmentUseCase } from "./application/use-cases/issue-installation-enrollment.use-case";
import { ListInstallationsUseCase } from "./application/use-cases/list-installations.use-case";
import { RecordInstallationHeartbeatUseCase } from "./application/use-cases/record-installation-heartbeat.use-case";
import { RevokeInstallationCredentialUseCase } from "./application/use-cases/revoke-installation-credential.use-case";
import { INSTALLATION_CREATION_UNIT_OF_WORK } from "./application/ports/installation-creation-unit-of-work.port";
import { INSTALLATION_CREDENTIAL_REPOSITORY } from "./application/ports/installation-credential-repository.port";
import { INSTALLATION_CREDENTIAL_VERIFIER } from "./application/ports/installation-credential-verifier.port";
import { INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK } from "./application/ports/installation-enrollment-consumption-unit-of-work.port";
import { INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK } from "./application/ports/installation-enrollment-issuance-unit-of-work.port";
import { INSTALLATION_ENROLLMENT_REPOSITORY } from "./application/ports/installation-enrollment-repository.port";
import { INSTALLATION_HEALTH_READER } from "./application/ports/installation-health-reader.port";
import { INSTALLATION_HEALTH_WRITER } from "./application/ports/installation-health-writer.port";
import { INSTALLATION_SECRET_GENERATOR } from "./application/ports/installation-secret-generator.port";
import { INSTALLATION_REPOSITORY } from "./domain/installation-repository.port";
import { CryptoInstallationSecretGenerator } from "./infrastructure/security/crypto-installation-secret-generator.adapter";
import { InstallationCredentialRecord } from "./infrastructure/persistence/installation-credential.record";
import { InstallationEnrollmentRecord } from "./infrastructure/persistence/installation-enrollment.record";
import { InstallationHealthRecord } from "./infrastructure/persistence/installation-health.record";
import { InstallationRecord } from "./infrastructure/persistence/installation.record";
import { TypeOrmInstallationCreationUnitOfWork } from "./infrastructure/persistence/typeorm-installation-creation-unit-of-work";
import { TypeOrmInstallationCredentialRepository } from "./infrastructure/persistence/typeorm-installation-credential.repository";
import { TypeOrmInstallationCredentialVerifierAdapter } from "./infrastructure/persistence/typeorm-installation-credential-verifier.adapter";
import { TypeOrmInstallationEnrollmentConsumptionUnitOfWork } from "./infrastructure/persistence/typeorm-installation-enrollment-consumption-unit-of-work";
import { TypeOrmInstallationEnrollmentIssuanceUnitOfWork } from "./infrastructure/persistence/typeorm-installation-enrollment-issuance-unit-of-work";
import { TypeOrmInstallationEnrollmentRepository } from "./infrastructure/persistence/typeorm-installation-enrollment.repository";
import { TypeOrmInstallationHealthRepository } from "./infrastructure/persistence/typeorm-installation-health.repository";
import { TypeOrmInstallationRepository } from "./infrastructure/persistence/typeorm-installation.repository";
import { InstallationAuthGuard } from "./presentation/http/guards/installation-auth.guard";
import { InstallationAuthController } from "./presentation/http/installation-auth.controller";
import { InstallationController } from "./presentation/http/installation.controller";
import { InstallationHealthController } from "./presentation/http/installation-health.controller";

/**
 * Public NestJS module for the Installations bounded context. `CUSTOMER_READER_PORT`,
 * `LICENSE_READER_PORT`, `CUSTOMER_SUMMARY_READER_PORT`, and `LICENSE_SUMMARY_READER_PORT` (see
 * application/ports) are injected by CreateInstallationUseCase/EnrollInstallationUseCase/
 * GetCustomerSummariesUseCase/GetLicenseSummariesUseCase but NOT bound here - the composition root
 * (apps/api) supplies all four in-process adapters globally.
 *
 * `InstallationAuthGuard` is exported (alongside the controllers) so ControlPlaneModule can register
 * it as a global `APP_GUARD` via `useExisting` - the same reason AccessTokenGuard/
 * AdminAuthorizationGuard are exported from AccessManagementModule (see that module's own comment):
 * `useClass` would construct a new instance scoped to ControlPlaneModule's own injector, unable to
 * resolve `INSTALLATION_CREDENTIAL_VERIFIER`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstallationRecord,
      InstallationEnrollmentRecord,
      InstallationCredentialRecord,
      InstallationHealthRecord,
    ]),
  ],
  controllers: [InstallationController, InstallationAuthController, InstallationHealthController],
  providers: [
    { provide: INSTALLATION_REPOSITORY, useClass: TypeOrmInstallationRepository },
    {
      provide: INSTALLATION_ENROLLMENT_REPOSITORY,
      useClass: TypeOrmInstallationEnrollmentRepository,
    },
    {
      provide: INSTALLATION_CREDENTIAL_REPOSITORY,
      useClass: TypeOrmInstallationCredentialRepository,
    },
    {
      provide: INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK,
      useClass: TypeOrmInstallationEnrollmentIssuanceUnitOfWork,
    },
    {
      provide: INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK,
      useClass: TypeOrmInstallationEnrollmentConsumptionUnitOfWork,
    },
    {
      provide: INSTALLATION_CREATION_UNIT_OF_WORK,
      useClass: TypeOrmInstallationCreationUnitOfWork,
    },
    {
      provide: INSTALLATION_CREDENTIAL_VERIFIER,
      useClass: TypeOrmInstallationCredentialVerifierAdapter,
    },
    { provide: INSTALLATION_SECRET_GENERATOR, useClass: CryptoInstallationSecretGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    TypeOrmInstallationHealthRepository,
    { provide: INSTALLATION_HEALTH_WRITER, useExisting: TypeOrmInstallationHealthRepository },
    { provide: INSTALLATION_HEALTH_READER, useExisting: TypeOrmInstallationHealthRepository },
    CreateInstallationUseCase,
    GetInstallationByIdUseCase,
    ListInstallationsUseCase,
    ChangeInstallationStatusUseCase,
    IssueInstallationEnrollmentUseCase,
    EnrollInstallationUseCase,
    RevokeInstallationCredentialUseCase,
    RecordInstallationHeartbeatUseCase,
    GetInstallationHealthUseCase,
    GetCustomerSummariesUseCase,
    GetLicenseSummariesUseCase,
    InstallationAuthGuard,
  ],
  exports: [InstallationAuthGuard],
})
export class InstallationsModule {}
