import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ChangeInstallationStatusUseCase } from "./application/use-cases/change-installation-status.use-case";
import { CreateInstallationUseCase } from "./application/use-cases/create-installation.use-case";
import { GetInstallationByIdUseCase } from "./application/use-cases/get-installation-by-id.use-case";
import { ListInstallationsUseCase } from "./application/use-cases/list-installations.use-case";
import { INSTALLATION_REPOSITORY } from "./domain/installation-repository.port";
import { InstallationRecord } from "./infrastructure/persistence/installation.record";
import { TypeOrmInstallationRepository } from "./infrastructure/persistence/typeorm-installation.repository";
import { InstallationController } from "./presentation/http/installation.controller";

/**
 * Public NestJS module for the Installations bounded context. `CUSTOMER_READER_PORT` and
 * `LICENSE_READER_PORT` (see application/ports) are injected by CreateInstallationUseCase but NOT
 * bound here - the composition root (apps/api) supplies both in-process adapters globally.
 */
@Module({
  imports: [TypeOrmModule.forFeature([InstallationRecord])],
  controllers: [InstallationController],
  providers: [
    { provide: INSTALLATION_REPOSITORY, useClass: TypeOrmInstallationRepository },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    CreateInstallationUseCase,
    GetInstallationByIdUseCase,
    ListInstallationsUseCase,
    ChangeInstallationStatusUseCase,
  ],
})
export class InstallationsModule {}
