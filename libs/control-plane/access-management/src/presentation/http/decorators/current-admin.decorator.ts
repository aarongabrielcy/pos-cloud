import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { UnauthorizedError } from "@pos-cloud/shared-kernel";
import type { CurrentAdminPrincipal, RequestWithCurrentAdmin } from "../current-admin-principal";

/** Only usable behind AccessTokenGuard - that guard is what populates `request.currentAdmin`. */
export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAdminPrincipal => {
    const request = context.switchToHttp().getRequest<RequestWithCurrentAdmin>();
    if (!request.currentAdmin) {
      throw new UnauthorizedError("INVALID_ACCESS_TOKEN", "Missing authenticated admin context.");
    }
    return request.currentAdmin;
  },
);
