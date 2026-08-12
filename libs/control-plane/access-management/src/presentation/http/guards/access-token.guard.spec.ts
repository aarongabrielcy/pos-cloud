import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedError } from "@pos-cloud/shared-kernel";
import type { AccessTokenVerifierPort } from "../../../application/ports/access-token.port";
import type { RequestWithCurrentAdmin } from "../current-admin-principal";
import { AccessTokenGuard } from "./access-token.guard";

function buildContext(request: Partial<RequestWithCurrentAdmin>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("AccessTokenGuard", () => {
  it("rejects a request with no Authorization header", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier);
    const context = buildContext({ headers: {} } as never);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer scheme", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier);
    const context = buildContext({ headers: { authorization: "Basic abc123" } } as never);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a token the verifier reports as invalid/expired", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn().mockResolvedValue(null) };
    const guard = new AccessTokenGuard(verifier);
    const context = buildContext({ headers: { authorization: "Bearer bad-token" } } as never);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it("allows a valid token and attaches currentAdmin to the request", async () => {
    const verifier: AccessTokenVerifierPort = {
      verify: jest.fn().mockResolvedValue({ adminUserId: "admin-1", sessionId: "session-1" }),
    };
    const guard = new AccessTokenGuard(verifier);
    const request = { headers: { authorization: "Bearer good-token" } } as RequestWithCurrentAdmin;
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentAdmin).toEqual({ adminUserId: "admin-1", sessionId: "session-1" });
  });
});
