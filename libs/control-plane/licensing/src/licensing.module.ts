import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CLOCK, ID_GENERATOR, RandomUuidGenerator, SystemClock } from "@pos-cloud/shared-kernel";
import { ChangeLicenseStatusUseCase } from "./application/use-cases/change-license-status.use-case";
import { CreateLicenseUseCase } from "./application/use-cases/create-license.use-case";
import { GetCustomerSummariesUseCase } from "./application/use-cases/get-customer-summaries.use-case";
import { GetLicenseByIdUseCase } from "./application/use-cases/get-license-by-id.use-case";
import { GetLicenseSummaryUseCase } from "./application/use-cases/get-license-summary.use-case";
import { GetLicensesByIdsUseCase } from "./application/use-cases/get-licenses-by-ids.use-case";
import { ListLicensesUseCase } from "./application/use-cases/list-licenses.use-case";
import { ReplaceLicenseEntitlementsUseCase } from "./application/use-cases/replace-license-entitlements.use-case";
import { LICENSE_REPOSITORY } from "./domain/license-repository.port";
import {
  LicenseEntitlementRecord,
  LicenseRecord,
} from "./infrastructure/persistence/license.record";
import { TypeOrmLicenseRepository } from "./infrastructure/persistence/typeorm-license.repository";
import { LicenseController } from "./presentation/http/license.controller";

/**
 * Public NestJS module for the Licensing bounded context. `CUSTOMER_READER_PORT` and
 * `CUSTOMER_SUMMARY_READER_PORT` (see application/ports) are injected by CreateLicenseUseCase and
 * GetCustomerSummariesUseCase respectively, but NOT bound here - the composition root (apps/api)
 * supplies both in-process adapter bindings globally. This module also exports
 * GetLicenseSummaryUseCase (single-id eligibility summary) and GetLicensesByIdsUseCase (batched
 * display summaries) - the minimum needed by the composition root to build Installations'
 * LicenseReaderPort and LicenseSummaryReaderPort adapters.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LicenseRecord, LicenseEntitlementRecord])],
  controllers: [LicenseController],
  providers: [
    { provide: LICENSE_REPOSITORY, useClass: TypeOrmLicenseRepository },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: RandomUuidGenerator },
    CreateLicenseUseCase,
    GetLicenseByIdUseCase,
    ListLicensesUseCase,
    ChangeLicenseStatusUseCase,
    ReplaceLicenseEntitlementsUseCase,
    GetLicenseSummaryUseCase,
    GetLicensesByIdsUseCase,
    GetCustomerSummariesUseCase,
  ],
  exports: [GetLicenseSummaryUseCase, GetLicensesByIdsUseCase],
})
export class LicensingModule {}
