import { SetMetadata } from "@nestjs/common";
import { IS_INSTALLATION_ENROLLMENT_KEY } from "@pos-cloud/shared-kernel";

/**
 * Marks the machine enrollment endpoint (`POST /installation-auth/enroll`). AccessTokenGuard and
 * AdminAuthorizationGuard both recognize `IS_INSTALLATION_ENROLLMENT_KEY` (imported from
 * shared-kernel, not from access-management - see that key's own comment) and skip unconditionally;
 * InstallationAuthGuard also no-ops on this key - the enrollment code presented in the request body
 * is this endpoint's own, independent authentication mechanism, verified inside
 * EnrollInstallationUseCase itself, not by any guard. Deliberately a distinct decorator from
 * `@Public()`: it is reachable with zero Bearer token, but it is NOT "no authentication at all" -
 * see docs/architecture/installation-enrollment.md#guards and the default-deny closure test that
 * enumerates every `@Public()` route and requires this one to carry its own, more specific key too.
 */
export const InstallationEnrollment = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_INSTALLATION_ENROLLMENT_KEY, true);
