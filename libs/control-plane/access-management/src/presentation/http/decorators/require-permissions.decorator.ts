import { SetMetadata } from "@nestjs/common";
import type { PermissionCode } from "../../../domain/permission";

/**
 * Requires a valid Bearer access token AND every listed permission (AND semantics, never OR - a
 * caller must have all of them). The variadic signature requires at least one code at the type
 * level (`[PermissionCode, ...PermissionCode[]]`) - calling this with zero arguments is a
 * compile-time error, not a silent "authenticated only" (use `@AuthenticatedOnly()` for that).
 */
export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";
export const RequirePermissions = (
  ...permissions: [PermissionCode, ...PermissionCode[]]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
