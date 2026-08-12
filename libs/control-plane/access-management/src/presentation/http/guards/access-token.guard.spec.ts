import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  IS_INSTALLATION_AUTHENTICATED_KEY,
  IS_INSTALLATION_ENROLLMENT_KEY,
  UnauthorizedError,
} from "@pos-cloud/shared-kernel";
import type { AccessTokenVerifierPort } from "../../../application/ports/access-token.port";
import type { RequestWithCurrentAdmin } from "../current-admin-principal";
import { AccessTokenGuard } from "./access-token.guard";

function buildContext(request: Partial<RequestWithCurrentAdmin>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {} as unknown,
  } as unknown as ExecutionContext;
}

/** Real Reflector, no metadata attached to the fake handler/class above - resolves as "not public". */
function buildReflector(): Reflector {
  return new Reflector();
}

describe("AccessTokenGuard", () => {
  it("rejects a request with no Authorization header", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const context = buildContext({ headers: {} } as never);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects a non-Bearer scheme", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const context = buildContext({ headers: { authorization: "Basic abc123" } } as never);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it("rejects a token the verifier reports as invalid/expired", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn().mockResolvedValue(null) };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const context = buildContext({ headers: { authorization: "Bearer bad-token" } } as never);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it("allows a valid token and attaches currentAdmin to the request", async () => {
    const verifier: AccessTokenVerifierPort = {
      verify: jest.fn().mockResolvedValue({ adminUserId: "admin-1", sessionId: "session-1" }),
    };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const request = { headers: { authorization: "Bearer good-token" } } as RequestWithCurrentAdmin;
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentAdmin).toEqual({ adminUserId: "admin-1", sessionId: "session-1" });
  });

  it("bypasses verification entirely for a route marked @Public - CLOUD-01C-B's escape hatch from the now-global guard", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => (() => undefined) as unknown,
      getClass: () => class {} as unknown,
    } as unknown as ExecutionContext;
    jest.spyOn(Reflector.prototype, "getAllAndOverride").mockReturnValue(true);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("bypasses verification entirely for a route marked @InstallationEnrollment() - CLOUD-01C-C's machine enrollment endpoint", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => (() => undefined) as unknown,
      getClass: () => class {} as unknown,
    } as unknown as ExecutionContext;
    jest
      .spyOn(Reflector.prototype, "getAllAndOverride")
      .mockImplementation((key: unknown) => key === IS_INSTALLATION_ENROLLMENT_KEY);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("bypasses verification entirely for a route marked @InstallationAuthenticated() - InstallationAuthGuard, not this guard, authenticates it", async () => {
    const verifier: AccessTokenVerifierPort = { verify: jest.fn() };
    const guard = new AccessTokenGuard(verifier, buildReflector());
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => (() => undefined) as unknown,
      getClass: () => class {} as unknown,
    } as unknown as ExecutionContext;
    jest
      .spyOn(Reflector.prototype, "getAllAndOverride")
      .mockImplementation((key: unknown) => key === IS_INSTALLATION_AUTHENTICATED_KEY);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
