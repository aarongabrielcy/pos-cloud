import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ChangeInstallationStatusUseCase } from "./application/use-cases/change-installation-status.use-case";
import { CreateInstallationUseCase } from "./application/use-cases/create-installation.use-case";
import { EnrollInstallationUseCase } from "./application/use-cases/enroll-installation.use-case";
import { GetInstallationByIdUseCase } from "./application/use-cases/get-installation-by-id.use-case";
import { IssueInstallationEnrollmentUseCase } from "./application/use-cases/issue-installation-enrollment.use-case";
import { ListInstallationsUseCase } from "./application/use-cases/list-installations.use-case";
import { RevokeInstallationCredentialUseCase } from "./application/use-cases/revoke-installation-credential.use-case";
import { INSTALLATION_CREDENTIAL_REPOSITORY } from "./application/ports/installation-credential-repository.port";
import { INSTALLATION_CREDENTIAL_VERIFIER } from "./application/ports/installation-credential-verifier.port";
import { INSTALLATION_ENROLLMENT_CONSUMPTION_UNIT_OF_WORK } from "./application/ports/installation-enrollment-consumption-unit-of-work.port";
import { INSTALLATION_ENROLLMENT_ISSUANCE_UNIT_OF_WORK } from "./application/ports/installation-enrollment-issuance-unit-of-work.port";
import { INSTALLATION_ENROLLMENT_REPOSITORY } from "./application/ports/installation-enrollment-repository.port";
import { INSTALLATION_SECRET_GENERATOR } from "./application/ports/installation-secret-generator.port";
import { INSTALLATION_REPOSITORY } from "./domain/installation-repository.port";
import { CryptoInstallationSecretGenerator } from "./infrastructure/security/crypto-installation-secret-generator.adapter";
import { InstallationCredentialRecord } from "./infrastructure/persistence/installation-credential.record";
import { InstallationEnrollmentRecord } from "./infrastructure/persistence/installation-enrollment.record";
import { InstallationRecord } from "./infrastructure/persistence/installation.record";
import { TypeOrmInstallationCredentialRepository } from "./infrastructure/persistence/typeorm-installation-credential.repository";
import { TypeOrmInstallationCredentialVerifierAdapter } from "./infrastructure/persistence/typeorm-installation-credential-verifier.adapter";
import { TypeOrmInstallationEnrollmentConsumptionUnitOfWork } from "./infrastructure/persistence/typeorm-installation-enrollment-consumption-unit-of-work";
import { TypeOrmInstallationEnrollmentIssuanceUnitOfWork } from "./infrastructure/persistence/typeorm-installation-enrollment-issuance-unit-of-work";
import { TypeOrmInstallationEnrollmentRepository } from "./infrastructure/persistence/typeorm-installation-enrollment.repository";
import { TypeOrmInstallationRepository } from "./infrastructure/persistence/typeorm-installation.repository";
import { InstallationAuthGuard } from "./presentation/http/guards/installation-auth.guard";
import { InstallationAuthController } from "./presentation/http/installation-auth.controller";
import { InstallationController } from "./presentation/http/installation.controller";

/**
 * Public NestJS module for the Installations bounded context. `CUSTOMER_READER_PORT` and
 * `LICENSE_READER_PORT` (see application/ports) are injected by CreateInstallationUseCase/
 * EnrollInstallationUseCase but NOT bound here - the composition root (apps/api) supplies both
 * in-process adapters globally.
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
    ]),
  ],
  controllers: [InstallationController, InstallationAuthController],
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
      provide: INSTALLATION_CREDENTIAL_VERIFIER,
      useClass: TypeOrmInstallationCredentialVerifierAdapter,
    },
    { provide: INSTALLATION_SECRET_GENERATOR, useClass: CryptoInstallationSecretGenerator },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    CreateInstallationUseCase,
    GetInstallationByIdUseCase,
    ListInstallationsUseCase,
    ChangeInstallationStatusUseCase,
    IssueInstallationEnrollmentUseCase,
    EnrollInstallationUseCase,
    RevokeInstallationCredentialUseCase,
    InstallationAuthGuard,
  ],
  exports: [InstallationAuthGuard],
})
export class InstallationsModule {}
