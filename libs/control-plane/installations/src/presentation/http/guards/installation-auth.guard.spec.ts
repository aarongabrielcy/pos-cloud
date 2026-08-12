import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_INSTALLATION_AUTHENTICATED_KEY } from "@pos-cloud/shared-kernel";
import type { InstallationCredentialVerifierPort } from "../../../application/ports/installation-credential-verifier.port";
import { InstallationStatus } from "../../../domain/installation-status";
import {
  InstallationCredentialInvalidError,
  InstallationDecommissionedError,
  InstallationSuspendedError,
} from "../../../domain/installation.errors";
import type { RequestWithCurrentInstallation } from "../current-installation-principal";
import { InstallationAuthGuard } from "./installation-auth.guard";

/** The reflector spies in buildGuard read metadata by key directly, not from the context - the second parameter exists only so every call site here reads symmetrically with the metadata passed to buildGuard. */
function buildContext(
  request: Partial<RequestWithCurrentInstallation>,
  _metadata: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (() => undefined) as unknown,
    getClass: () => class {} as unknown,
  } as unknown as ExecutionContext;
}

function buildGuard(
  verifier: InstallationCredentialVerifierPort,
  metadata: Record<string, unknown>,
) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, "getAllAndOverride")
    .mockImplementation((key: unknown) => metadata[key as string]);
  return new InstallationAuthGuard(verifier, reflector);
}

function fakeVerifier(result: Awaited<ReturnType<InstallationCredentialVerifierPort["verify"]>>) {
  return {
    verify: jest.fn().mockResolvedValue(result),
  } satisfies InstallationCredentialVerifierPort;
}

describe("InstallationAuthGuard", () => {
  it("no-ops (allows) a route without @InstallationAuthenticated() metadata", async () => {
    const verifier = fakeVerifier(null);
    const guard = buildGuard(verifier, {});
    const context = buildContext({ headers: {} } as never, {});

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects a missing Authorization header", async () => {
    const verifier = fakeVerifier(null);
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const context = buildContext({ headers: {} } as never, metadata);

    await expect(guard.canActivate(context)).rejects.toThrow(InstallationCredentialInvalidError);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects a malformed Bearer value (no <id>.<secret> separator)", async () => {
    const verifier = fakeVerifier(null);
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const context = buildContext(
      { headers: { authorization: "Bearer malformed-no-dot" } } as never,
      metadata,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(InstallationCredentialInvalidError);
    expect(verifier.verify).not.toHaveBeenCalled();
  });

  it("rejects when the verifier returns null (unknown id / wrong secret / revoked - all collapsed)", async () => {
    const verifier = fakeVerifier(null);
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const context = buildContext(
      { headers: { authorization: "Bearer credential-1.secret" } } as never,
      metadata,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(InstallationCredentialInvalidError);
    expect(verifier.verify).toHaveBeenCalledWith("credential-1", "secret");
  });

  it("allows a valid credential for an ACTIVE installation and attaches currentInstallation", async () => {
    const verifier = fakeVerifier({
      installationId: "installation-1",
      installationStatus: InstallationStatus.ACTIVE,
    });
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const request = {
      headers: { authorization: "Bearer credential-1.secret" },
    } as RequestWithCurrentInstallation;
    const context = buildContext(request, metadata);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.currentInstallation).toEqual({ installationId: "installation-1" });
  });

  it("rejects (403 INSTALLATION_SUSPENDED) a valid credential for a SUSPENDED installation", async () => {
    const verifier = fakeVerifier({
      installationId: "installation-1",
      installationStatus: InstallationStatus.SUSPENDED,
    });
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const context = buildContext(
      { headers: { authorization: "Bearer credential-1.secret" } } as never,
      metadata,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(InstallationSuspendedError);
  });

  it("rejects (403 INSTALLATION_DECOMMISSIONED) a valid credential for a DECOMMISSIONED installation", async () => {
    const verifier = fakeVerifier({
      installationId: "installation-1",
      installationStatus: InstallationStatus.DECOMMISSIONED,
    });
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const context = buildContext(
      { headers: { authorization: "Bearer credential-1.secret" } } as never,
      metadata,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(InstallationDecommissionedError);
  });

  it("fails closed (INSTALLATION_CREDENTIAL_INVALID) for an unexpected status such as PENDING - a credential should never exist for one by invariant", async () => {
    const verifier = fakeVerifier({
      installationId: "installation-1",
      installationStatus: InstallationStatus.PENDING,
    });
    const metadata = { [IS_INSTALLATION_AUTHENTICATED_KEY]: true };
    const guard = buildGuard(verifier, metadata);
    const context = buildContext(
      { headers: { authorization: "Bearer credential-1.secret" } } as never,
      metadata,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(InstallationCredentialInvalidError);
  });
});
