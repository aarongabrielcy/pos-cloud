// Public API of @pos-cloud/access-management.
// Deliberately excluded: infrastructure/persistence and presentation/http DTOs/controller internals.
// AccessTokenGuard and CurrentAdmin ARE exported - CLOUD-01C-A's brief asks for a "reusable access
// token authentication mechanism" precisely so a future global guard (CLOUD-01C-B) or another
// bounded context's protected route can reuse this one instead of reimplementing it.

export { AccessManagementModule } from "./access-management.module";

export { BootstrapFirstAdminUseCase } from "./application/use-cases/bootstrap-first-admin.use-case";
export type {
  BootstrapFirstAdminCommand,
  BootstrapFirstAdminResult,
} from "./application/use-cases/bootstrap-first-admin.use-case";
export { GetAdminProfileUseCase } from "./application/use-cases/get-admin-profile.use-case";
export type {
  AdminProfile,
  GetAdminProfileQuery,
} from "./application/use-cases/get-admin-profile.use-case";
export { LoginAdminUseCase } from "./application/use-cases/login-admin.use-case";
export type {
  LoginAdminCommand,
  LoginAdminResult,
} from "./application/use-cases/login-admin.use-case";
export { LogoutAdminUseCase } from "./application/use-cases/logout-admin.use-case";
export type { LogoutAdminCommand } from "./application/use-cases/logout-admin.use-case";
export { RefreshAdminSessionUseCase } from "./application/use-cases/refresh-admin-session.use-case";
export type {
  RefreshAdminSessionCommand,
  RefreshAdminSessionResult,
} from "./application/use-cases/refresh-admin-session.use-case";

export { AdminUserStatus } from "./domain/admin-user-status";
export * from "./domain/admin-user.errors";
export * from "./domain/admin-session.errors";

export { CurrentAdmin } from "./presentation/http/decorators/current-admin.decorator";
export type { CurrentAdminPrincipal } from "./presentation/http/current-admin-principal";
export { AccessTokenGuard } from "./presentation/http/guards/access-token.guard";
