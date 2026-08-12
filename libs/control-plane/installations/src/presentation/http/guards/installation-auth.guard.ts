import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_INSTALLATION_AUTHENTICATED_KEY } from "@pos-cloud/shared-kernel";
import {
  INSTALLATION_CREDENTIAL_VERIFIER,
  type InstallationCredentialVerifierPort,
} from "../../../application/ports/installation-credential-verifier.port";
import { parseOpaqueToken } from "../../../application/opaque-token-format";
import { InstallationStatus } from "../../../domain/installation-status";
import {
  InstallationCredentialInvalidError,
  InstallationDecommissionedError,
  InstallationSuspendedError,
} from "../../../domain/installation.errors";
import type { RequestWithCurrentInstallation } from "../current-installation-principal";

/**
 * Registered globally (`APP_GUARD`, see ControlPlaneModule), 3rd after AccessTokenGuard and
 * AdminAuthorizationGuard. No-ops (`return true`) on every route that doesn't carry
 * `@InstallationAuthenticated()` - it never touches admin routes, `@Public()` routes, or the
 * `@InstallationEnrollment()` enroll route (that one authenticates via its own body-level enrollment
 * code, not a Bearer credential). See docs/architecture/installation-enrollment.md#guards.
 *
 * Deliberately does NOT double as a second default-deny layer: an unclassified route is already
 * correctly rejected by AdminAuthorizationGuard's own default-deny (see that guard's comment) before
 * this guard ever runs its real check, so this guard's only job is the positive case.
 */
@Injectable()
export class InstallationAuthGuard implements CanActivate {
  constructor(
    @Inject(INSTALLATION_CREDENTIAL_VERIFIER)
    private readonly credentialVerifier: InstallationCredentialVerifierPort,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isInstallationAuthenticated = this.reflector.getAllAndOverride<boolean>(
      IS_INSTALLATION_AUTHENTICATED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isInstallationAuthenticated) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCurrentInstallation>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new InstallationCredentialInvalidError();
    }

    const parsed = parseOpaqueToken(token);
    if (!parsed) {
      throw new InstallationCredentialInvalidError();
    }

    const verified = await this.credentialVerifier.verify(parsed.id, parsed.secret);
    if (!verified) {
      throw new InstallationCredentialInvalidError();
    }

    if (verified.installationStatus === InstallationStatus.SUSPENDED) {
      throw new InstallationSuspendedError();
    }
    if (verified.installationStatus === InstallationStatus.DECOMMISSIONED) {
      throw new InstallationDecommissionedError();
    }
    if (verified.installationStatus !== InstallationStatus.ACTIVE) {
      // PENDING (or any future status) should never have a credential by invariant - fail closed
      // rather than authenticate against an unexpected state.
      throw new InstallationCredentialInvalidError();
    }

    request.currentInstallation = { installationId: verified.installationId };
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
