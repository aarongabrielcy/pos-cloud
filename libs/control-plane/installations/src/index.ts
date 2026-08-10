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
export { Platform } from "./domain/platform";
export * from "./domain/installation.errors";
