import { SetMetadata } from "@nestjs/common";
import { IS_INSTALLATION_AUTHENTICATED_KEY } from "@pos-cloud/shared-kernel";

/**
 * Requires a valid installation Bearer credential (InstallationAuthGuard performs the real check).
 * AccessTokenGuard and AdminAuthorizationGuard both recognize `IS_INSTALLATION_AUTHENTICATED_KEY` and
 * skip unconditionally - they have no concept of installation credentials, and installations don't
 * have admin RBAC permissions to resolve in V1 (binary authenticated-and-ACTIVE-or-not, no
 * `@RequirePermissions`-equivalent tier) - see docs/architecture/installation-enrollment.md#guards.
 */
export const InstallationAuthenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_INSTALLATION_AUTHENTICATED_KEY, true);
