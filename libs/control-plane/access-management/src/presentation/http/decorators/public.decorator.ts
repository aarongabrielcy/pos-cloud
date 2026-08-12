import { SetMetadata } from "@nestjs/common";

/**
 * Bypasses both AccessTokenGuard and AdminAuthorizationGuard entirely - no Bearer token required,
 * no permission resolved. Reserved for routes with their own independent security mechanism (login,
 * refresh/logout's own refresh-cookie validation) or that must be reachable with zero credentials
 * (health checks) - see docs/architecture/admin-rbac.md#default-deny. Applying this to a business
 * endpoint is exactly the failure mode the default-deny meta-test (default-deny.meta.spec.ts) exists
 * to catch.
 */
export const IS_PUBLIC_KEY = "isPublic";
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
