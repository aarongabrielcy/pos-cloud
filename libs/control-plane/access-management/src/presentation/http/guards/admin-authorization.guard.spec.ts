import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ForbiddenError,
  IS_INSTALLATION_AUTHENTICATED_KEY,
  IS_INSTALLATION_ENROLLMENT_KEY,
  UnauthorizedError,
} from "@pos-cloud/shared-kernel";
import { FakePermissionResolver } from "../../../test-support/fake-permission-resolver";
import type { RequestWithCurrentAdmin } from "../current-admin-principal";
import { IS_AUTHENTICATED_ONLY_KEY } from "../decorators/authenticated-only.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { AdminAuthorizationGuard } from "./admin-authorization.guard";

function buildContext(
  request: Partial<RequestWithCurrentAdmin>,
  metadata: Record<string, unknown>,
): ExecutionContext {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, "getAllAndOverride")
    .mockImplementation((key: unknown) => metadata[key as string]);

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {} as unknown,
  } as unknown as ExecutionContext;

  return context;
}

function buildGuard(resolver: FakePermissionResolver, metadata: Record<string, unknown>) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, "getAllAndOverride")
    .mockImplementation((key: unknown) => metadata[key as string]);
  return new AdminAuthorizationGuard(resolver, reflector);
}

describe("AdminAuthorizationGuard", () => {
  it("allows a @Public route without resolving any permission", async () => {
    const resolver = new FakePermissionResolver();
    const resolveSpy = jest.spyOn(resolver, "resolveEffectivePermissions");
    const guard = buildGuard(resolver, { [IS_PUBLIC_KEY]: true });
    const context = buildContext({}, { [IS_PUBLIC_KEY]: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("allows an @AuthenticatedOnly route without resolving any permission", async () => {
    const resolver = new FakePermissionResolver();
    const resolveSpy = jest.spyOn(resolver, "resolveEffectivePermissions");
    const guard = buildGuard(resolver, { [IS_AUTHENTICATED_ONLY_KEY]: true });
    const context = buildContext(
      { currentAdmin: { adminUserId: "admin-1", sessionId: "session-1" } },
      { [IS_AUTHENTICATED_ONLY_KEY]: true },
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("default-denies (403) a route with no @Public/@AuthenticatedOnly/@RequirePermissions metadata at all", async () => {
    const resolver = new FakePermissionResolver();
    const guard = buildGuard(resolver, {});
    const context = buildContext(
      { currentAdmin: { adminUserId: "admin-1", sessionId: "session-1" } },
      {},
    );

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenError);
  });

  it("allows a @RequirePermissions route when the admin has every required permission", async () => {
    const resolver = new FakePermissionResolver();
    resolver.grant("admin-1", "customers.read", "customers.create");
    const metadata = { [REQUIRED_PERMISSIONS_KEY]: ["customers.read"] };
    const guard = buildGuard(resolver, metadata);
    const context = buildContext(
      { currentAdmin: { adminUserId: "admin-1", sessionId: "session-1" } },
      metadata,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("rejects (403) a @RequirePermissions route when the admin is missing even one of several required permissions", async () => {
    const resolver = new FakePermissionResolver();
    resolver.grant("admin-1", "licenses.read");
    const metadata = {
      [REQUIRED_PERMISSIONS_KEY]: ["licenses.read", "licenses.entitlements.manage"],
    };
    const guard = buildGuard(resolver, metadata);
    const context = buildContext(
      { currentAdmin: { adminUserId: "admin-1", sessionId: "session-1" } },
      metadata,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenError);
  });

  it("rejects (401, not 403) a @RequirePermissions route with no currentAdmin - proves it never checks permissions before authentication has run", async () => {
    const resolver = new FakePermissionResolver();
    const metadata = { [REQUIRED_PERMISSIONS_KEY]: ["customers.read"] };
    const guard = buildGuard(resolver, metadata);
    const context = buildContext({}, metadata);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedError);
  });

  it("allows a @InstallationEnrollment() route without resolving any permission - CLOUD-01C-C's machine enrollment endpoint", async () => {
    const resolver = new FakePermissionResolver();
    const resolveSpy = jest.spyOn(resolver, "resolveEffectivePermissions");
    const guard = buildGuard(resolver, { [IS_INSTALLATION_ENROLLMENT_KEY]: true });
    const context = buildContext({}, { [IS_INSTALLATION_ENROLLMENT_KEY]: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveSpy).not.toHaveBeenCalled();
  });

  it("allows a @InstallationAuthenticated() route without resolving any admin permission - InstallationAuthGuard does the real check", async () => {
    const resolver = new FakePermissionResolver();
    const resolveSpy = jest.spyOn(resolver, "resolveEffectivePermissions");
    const guard = buildGuard(resolver, { [IS_INSTALLATION_AUTHENTICATED_KEY]: true });
    const context = buildContext({}, { [IS_INSTALLATION_AUTHENTICATED_KEY]: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});
