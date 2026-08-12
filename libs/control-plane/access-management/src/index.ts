// Public API of @pos-cloud/access-management.
// Deliberately excluded: infrastructure/persistence and presentation/http DTOs/controller internals.
// AccessTokenGuard and CurrentAdmin ARE exported - CLOUD-01C-A's brief asks for a "reusable access
// token authentication mechanism" precisely so a future global guard (CLOUD-01C-B) or another
// bounded context's protected route can reuse this one instead of reimplementing it.
//
// PERMISSIONS/PermissionCode/RequirePermissions/Public/AuthenticatedOnly (CLOUD-01C-B) are exported
// so Customer Management/Licensing/Installations controllers can protect their own endpoints without
// duplicating the catalog. This is a one-directional dependency: those contexts may import this
// package's public API, but this package never imports theirs - see
// .dependency-cruiser.cjs and docs/architecture/admin-rbac.md#cross-context.

export { AccessManagementModule } from "./access-management.module";

export { AssignRoleToAdminUseCase } from "./application/use-cases/assign-role-to-admin.use-case";
export type { AssignRoleToAdminCommand } from "./application/use-cases/assign-role-to-admin.use-case";

// PERMISSION_RESOLVER/PermissionResolverPort are exported solely so composition-root-level HTTP
// tests (apps/api) can `.overrideProvider(PERMISSION_RESOLVER)` with a fake and drive the real
// AdminAuthorizationGuard end-to-end without a PostgreSQL connection - the same reason
// GetAdminProfileUseCase etc. are exported below. Never meant for runtime business logic outside
// this package.
export { PERMISSION_RESOLVER } from "./application/ports/permission-resolver.port";
export type { PermissionResolverPort } from "./application/ports/permission-resolver.port";

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

export { ADMIN_ROLES } from "./domain/admin-role";
export type { AdminRoleCode } from "./domain/admin-role";
export { AdminUserStatus } from "./domain/admin-user-status";
export * from "./domain/admin-user.errors";
export * from "./domain/admin-session.errors";
export { PERMISSIONS } from "./domain/permission";
export type { PermissionCode } from "./domain/permission";

export {
  AuthenticatedOnly,
  IS_AUTHENTICATED_ONLY_KEY,
} from "./presentation/http/decorators/authenticated-only.decorator";
export { CurrentAdmin } from "./presentation/http/decorators/current-admin.decorator";
export { IS_PUBLIC_KEY, Public } from "./presentation/http/decorators/public.decorator";
export {
  REQUIRED_PERMISSIONS_KEY,
  RequirePermissions,
} from "./presentation/http/decorators/require-permissions.decorator";
export type { CurrentAdminPrincipal } from "./presentation/http/current-admin-principal";
export { AdminAuthorizationGuard } from "./presentation/http/guards/admin-authorization.guard";
export { AccessTokenGuard } from "./presentation/http/guards/access-token.guard";
