import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { UnauthorizedError } from "@pos-cloud/shared-kernel";
import {
  ACCESS_TOKEN_VERIFIER,
  type AccessTokenVerifierPort,
} from "../../../application/ports/access-token.port";
import type { RequestWithCurrentAdmin } from "../current-admin-principal";

/**
 * Reusable Bearer-JWT authentication gate. In CLOUD-01C-A only `GET /auth/me` uses it (see
 * AuthController) - CLOUD-01C-B is what turns this into blanket Control Plane protection (e.g. via
 * `APP_GUARD`), not this task.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly accessTokenVerifier: AccessTokenVerifierPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
