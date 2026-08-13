import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AUDIT_RECORDER_PORT,
  CLOCK,
  ID_GENERATOR,
  RandomUuidGenerator,
  SystemClock,
} from "@pos-cloud/shared-kernel";
import { ListAuditEventsUseCase } from "./application/use-cases/list-audit-events.use-case";
import { AUDIT_EVENT_REPOSITORY } from "./application/ports/audit-event-repository.port";
import { AuditEventRecord } from "./infrastructure/persistence/audit-event.record";
import { TypeOrmAuditEventRepository } from "./infrastructure/persistence/typeorm-audit-event.repository";
import { AuditRecorderAdapter } from "./infrastructure/audit-recorder.adapter";
import { AuditController } from "./presentation/http/audit.controller";

/**
 * `@Global()` so every producer bounded context (customer-management, licensing, installations,
 * access-management) can `@Inject(AUDIT_RECORDER_PORT)` (defined in shared-kernel) without importing
 * this module or package themselves - the same reason InstallationAuthConfigModule is `@Global()`.
 * Unlike CrossContextPortsModule's CustomerReaderAdapter/LicenseReaderAdapter (which live in apps/api
 * because they need to call INTO another bounded context's use cases), AuditRecorderAdapter needs
 * only this package's own repository - so the binding happens right here, no apps/api-level
 * composition needed beyond importing this one module. See ADR-015.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditEventRecord])],
  controllers: [AuditController],
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    { provide: AUDIT_EVENT_REPOSITORY, useClass: TypeOrmAuditEventRepository },
    AuditRecorderAdapter,
    { provide: AUDIT_RECORDER_PORT, useExisting: AuditRecorderAdapter },
    ListAuditEventsUseCase,
  ],
  exports: [AUDIT_RECORDER_PORT],
})
export class AuditModule {}
