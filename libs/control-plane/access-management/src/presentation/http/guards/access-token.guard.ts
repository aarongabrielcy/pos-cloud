import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UnauthorizedError } from "@pos-cloud/shared-kernel";
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifierPort,
} from "../../../application/ports/access-token.port";
import type { RequestWithCurrentAdmin } from "../current-admin-principal";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * Reusable Bearer-JWT authentication gate. Registered globally (`APP_GUARD`, see
 * ControlPlaneModule) since CLOUD-01C-B - every route is authenticated by default, `@Public()` is
 * the only opt-out (see that decorator's own comment). Runs before AdminAuthorizationGuard (guard
 * registration order in ControlPlaneModule), so a missing/invalid token always produces 401, never
 * 403 - a request that hasn't authenticated yet has nothing for AdminAuthorizationGuard to resolve
 * permissions against.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly accessTokenVerifier: AccessTokenVerifierPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentAdmin>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedError(
        "INVALID_ACCESS_TOKEN",
        "Missing or malformed Authorization header.",
      );
    }

    const verified = await this.accessTokenVerifier.verify(token);
    if (!verified) {
      throw new UnauthorizedError("INVALID_ACCESS_TOKEN", "Invalid or expired access token.");
    }

    request.currentAdmin = { adminUserId: verified.adminUserId, sessionId: verified.sessionId };
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
}
