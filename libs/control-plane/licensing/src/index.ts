// Public API of @pos-cloud/licensing.
// Deliberately excluded: infrastructure/persistence and presentation/http internals.

export { LicensingModule } from "./licensing.module";

export { CreateLicenseUseCase } from "./application/use-cases/create-license.use-case";
export type { CreateLicenseCommand } from "./application/use-cases/create-license.use-case";
export { GetLicenseByIdUseCase } from "./application/use-cases/get-license-by-id.use-case";
export { ListLicensesUseCase } from "./application/use-cases/list-licenses.use-case";
export type { ListLicensesQuery } from "./application/use-cases/list-licenses.use-case";
export { ChangeLicenseStatusUseCase } from "./application/use-cases/change-license-status.use-case";
export type { ChangeLicenseStatusCommand } from "./application/use-cases/change-license-status.use-case";
export { ReplaceLicenseEntitlementsUseCase } from "./application/use-cases/replace-license-entitlements.use-case";
export type { ReplaceLicenseEntitlementsCommand } from "./application/use-cases/replace-license-entitlements.use-case";
export { GetLicenseSummaryUseCase } from "./application/use-cases/get-license-summary.use-case";
export type { LicenseSummary } from "./application/use-cases/get-license-summary.use-case";

export {
  CUSTOMER_READER_PORT,
  type CustomerReaderPort,
  type CustomerSummary,
} from "./application/ports/customer-reader.port";

export type { License, ReplaceEntitlementItemInput } from "./domain/license";
export type { LicenseEntitlement } from "./domain/license-entitlement";
export { LicenseEdition } from "./domain/license-edition";
export { LicenseModel } from "./domain/license-model";
export { LicenseStatus } from "./domain/license-status";
export * from "./domain/license.errors";
