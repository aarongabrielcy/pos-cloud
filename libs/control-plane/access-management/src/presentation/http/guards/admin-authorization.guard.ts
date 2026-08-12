import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ForbiddenError, UnauthorizedError } from "@pos-cloud/shared-kernel";
import {
  PERMISSION_RESOLVER,
  type PermissionResolverPort,
} from "../../../application/ports/permission-resolver.port";
import type { PermissionCode } from "../../../domain/permission";
import type { RequestWithCurrentAdmin } from "../current-admin-principal";
import { IS_AUTHENTICATED_ONLY_KEY } from "../decorators/authenticated-only.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";

const GENERIC_FORBIDDEN_MESSAGE = "You do not have permission to perform this action.";

/**
 * Registered globally (`APP_GUARD`, see ControlPlaneModule), always AFTER AccessTokenGuard - by the
 * time this runs, `request.currentAdmin` is already populated for any non-`@Public()` route (see
 * that guard's own comment).
 *
 * Default-deny: a handler with none of `@Public()`, `@AuthenticatedOnly()`, or
 * `@RequirePermissions()` is rejected with 403, even though it's authenticated - see
 * docs/architecture/admin-rbac.md#default-deny. This is the deliberate fix for "a developer adds a
 * new administrative endpoint and forgets to annotate it": the endpoint fails loudly (403 on first
 * use/test) instead of silently being reachable by any authenticated admin.
 *
 * The 403 body is always the same generic message/code regardless of the actual reason (missing
 * permission vs. SUSPENDED resolving to an empty set, see TypeOrmPermissionResolverAdapter) -
 * deliberately not revealing which permission was required, so a client probing with a stolen JWT
 * can't map out the internal permission taxonomy or learn "this admin is suspended" from the
 * response shape.
 */
@Injectable()
export class AdminAuthorizationGuard implements CanActivate {
  constructor(
    @Inject(PERMISSION_RESOLVER) private readonly permissionResolver: PermissionResolverPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY_KEY, targets)) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<PermissionCode[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      targets,
    );
    if (!required || required.length === 0) {
      throw new ForbiddenError("FORBIDDEN", GENERIC_FORBIDDEN_MESSAGE);
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentAdmin>();
    const currentAdmin = request.currentAdmin;
    if (!currentAdmin) {
      // AccessTokenGuard always runs first and populates this for any non-@Public route - reaching
      // here without it means guard registration order is broken, not that the caller is
      // unauthenticated (AccessTokenGuard would already have thrown 401 for that).
      throw new UnauthorizedError("INVALID_ACCESS_TOKEN", "Missing authenticated admin context.");
    }

    const effectivePermissions = await this.permissionResolver.resolveEffectivePermissions(
      currentAdmin.adminUserId,
    );
    const hasEveryRequiredPermission = required.every((code) => effectivePermissions.has(code));
    if (!hasEveryRequiredPermission) {
      throw new ForbiddenError("FORBIDDEN", GENERIC_FORBIDDEN_MESSAGE);
    }

    return true;
  }
}
