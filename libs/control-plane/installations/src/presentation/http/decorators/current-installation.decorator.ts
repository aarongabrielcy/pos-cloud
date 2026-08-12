import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { UnauthorizedError } from "@pos-cloud/shared-kernel";
import type {
  CurrentInstallationPrincipal,
  RequestWithCurrentInstallation,
} from "../current-installation-principal";

/** Only usable behind InstallationAuthGuard - that guard is what populates `request.currentInstallation`. */
export const CurrentInstallation = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentInstallationPrincipal => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentInstallation>();
    if (!request.currentInstallation) {
      throw new UnauthorizedError(
        "INSTALLATION_CREDENTIAL_INVALID",
        "Missing authenticated installation context.",
      );
    }
    return request.currentInstallation;
  },
);
