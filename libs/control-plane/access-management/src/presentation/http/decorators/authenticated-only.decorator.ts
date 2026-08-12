import { SetMetadata } from "@nestjs/common";

/**
 * Requires a valid Bearer access token (AccessTokenGuard still runs) but skips permission
 * resolution entirely (AdminAuthorizationGuard allows unconditionally) - reserved for identity-only
 * routes with no business permission to check, today only `GET /auth/me`. Deliberately a distinct
 * decorator from `@RequirePermissions()` (never called with zero arguments - see that decorator's
 * own comment) so "authenticated, no specific permission" is an explicit, greppable choice, not
 * something that could be produced by an empty array.
 */
export const IS_AUTHENTICATED_ONLY_KEY = "isAuthenticatedOnly";
export const AuthenticatedOnly = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_AUTHENTICATED_ONLY_KEY, true);
