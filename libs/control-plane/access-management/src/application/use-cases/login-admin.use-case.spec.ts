import type { AuthConfig } from "@pos-cloud/config";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { AdminSessionId } from "../../domain/admin-session-id";
import { AdminUser, MAX_FAILED_LOGIN_ATTEMPTS } from "../../domain/admin-user";
import { AdminUserStatus } from "../../domain/admin-user-status";
import { InvalidAdminCredentialsError } from "../../domain/admin-user.errors";
import { FakeAccessTokenIssuer } from "../../test-support/fake-access-token-issuer";
import { FakePasswordHasher } from "../../test-support/fake-password-hasher";
import { FakeRefreshTokenGenerator } from "../../test-support/fake-refresh-token-generator";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminSessionStore } from "../../test-support/in-memory-admin-session-store";
import { InMemoryAdminUserRepository } from "../../test-support/in-memory-admin-user-repository";
import { LoginAdminUseCase } from "./login-admin.use-case";

const authConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

async function setup() {
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const users = new InMemoryAdminUserRepository();
  const sessions = new InMemoryAdminSessionStore();
  const hasher = new FakePasswordHasher();
  const tokenIssuer = new FakeAccessTokenIssuer();
  const refreshGenerator = new FakeRefreshTokenGenerator();
  const idGenerator = new RandomUuidGenerator();

  const useCase = new LoginAdminUseCase(
    users,
    sessions,
    hasher,
    tokenIssuer,
    refreshGenerator,
    clock,
    idGenerator,
    authConfig,
  );

  const passwordHash = await hasher.hash("correct-horse-battery-staple");
  const user = AdminUser.create(
    { id: idGenerator.next(), email: "admin@example.com", displayName: "Root Admin", passwordHash },
    clock,
  );
  await users.save(user);

  return { clock, users, sessions, hasher, tokenIssuer, refreshGenerator, useCase, user };
}

describe("LoginAdminUseCase", () => {
  it("succeeds with correct credentials and returns an access + refresh token", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({
      email: "admin@example.com",
      password: "correct-horse-battery-staple",
    });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.expiresInSeconds).toBe(900);
    expect(result.refreshToken.sessionId).toEqual(expect.any(String));
    expect(result.refreshToken.secret).toEqual(expect.any(String));
    expect(result.user.email).toBe("admin@example.com");
  });

  it("accepts a differently-cased email (case-insensitive lookup)", async () => {
    const { useCase } = await setup();

    const result = await useCase.execute({
      email: "Admin@Example.com",
      password: "correct-horse-battery-staple",
    });

    expect(result.user.email).toBe("admin@example.com");
  });

  it("persists a session that can later be found by id", async () => {
    const { useCase, sessions } = await setup();

    const result = await useCase.execute({
      email: "admin@example.com",
      password: "correct-horse-battery-staple",
    });

    const session = await sessions.findById(AdminSessionId.of(result.refreshToken.sessionId));
    expect(session).not.toBeNull();
  });

  it("rejects an unknown email with the generic invalid-credentials error", async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ email: "nobody@example.com", password: "whatever-12345" }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  it("rejects a wrong password with the generic invalid-credentials error", async () => {
    const { useCase } = await setup();

    await expect(
      useCase.execute({ email: "admin@example.com", password: "totally-wrong-password" }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  describe("timing side-channel mitigation (unknown email vs wrong password)", () => {
    // Regression tests: an unknown email used to return without ever running Argon2id (verify()
    // is only reachable once an AdminUser is found), making that path measurably faster than "wrong
    // password for a real account" - an attacker could enumerate valid admin emails by response
    // latency alone. LoginAdminUseCase now calls passwordHasher.verifyDummy() instead of skipping
    // verification. These tests assert call counts/arguments, not wall-clock time - see this
    // describe block's own no-timing-assertions note below and CLOUD-01C-A's correction brief
    // ("Test A"/"Test D": no `expect(responseTime)...` assertions, which would be flaky in CI).

    it("Test A - unknown email: never calls verify(), calls verifyDummy() exactly once, still rejects", async () => {
      const { useCase, hasher } = await setup();
      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");

      await expect(
        useCase.execute({ email: "nobody@example.com", password: "whatever-12345" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);

      expect(verifyDummySpy).toHaveBeenCalledTimes(1);
      expect(verifyDummySpy).toHaveBeenCalledWith("whatever-12345");
      expect(verifySpy).not.toHaveBeenCalled();
    });

    it("Test B - existing email + wrong password: calls verify() exactly once against the real hash, never calls verifyDummy(), still increments the failure counter", async () => {
      const { useCase, hasher, users, user } = await setup();
      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");

      await expect(
        useCase.execute({ email: "admin@example.com", password: "totally-wrong-password" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);

      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).toHaveBeenCalledWith(user.passwordHash, "totally-wrong-password");
      expect(verifyDummySpy).not.toHaveBeenCalled();

      const reloaded = await users.findById(user.id);
      expect(reloaded?.failedLoginAttempts).toBe(1);
    });

    it("Test C - existing email + correct password: calls verify() exactly once, never calls verifyDummy(), returns 200-equivalent tokens", async () => {
      const { useCase, hasher } = await setup();
      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");

      const result = await useCase.execute({
        email: "admin@example.com",
        password: "correct-horse-battery-staple",
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken.sessionId).toEqual(expect.any(String));
      expect(verifySpy).toHaveBeenCalledTimes(1);
      expect(verifyDummySpy).not.toHaveBeenCalled();
    });

    it("Test D - both unknown email and existing-email-wrong-password run exactly one costly verification each (never zero, never two)", async () => {
      const { useCase, hasher } = await setup();
      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");

      await expect(
        useCase.execute({ email: "nobody@example.com", password: "whatever-12345" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
      const unknownEmailCalls = verifySpy.mock.calls.length + verifyDummySpy.mock.calls.length;

      verifySpy.mockClear();
      verifyDummySpy.mockClear();

      await expect(
        useCase.execute({ email: "admin@example.com", password: "totally-wrong-password" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
      const wrongPasswordCalls = verifySpy.mock.calls.length + verifyDummySpy.mock.calls.length;

      expect(unknownEmailCalls).toBe(1);
      expect(wrongPasswordCalls).toBe(1);
    });
  });

  it("increments failedLoginAttempts on a wrong password", async () => {
    const { useCase, users, user } = await setup();

    await expect(
      useCase.execute({ email: "admin@example.com", password: "wrong-password-here" }),
    ).rejects.toThrow(InvalidAdminCredentialsError);

    const reloaded = await users.findById(user.id);
    expect(reloaded?.failedLoginAttempts).toBe(1);
  });

  it(`locks the account after ${MAX_FAILED_LOGIN_ATTEMPTS} consecutive wrong passwords`, async () => {
    const { useCase, users, user } = await setup();

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i += 1) {
      await expect(
        useCase.execute({ email: "admin@example.com", password: "wrong-password-here" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
    }

    const reloaded = await users.findById(user.id);
    expect(reloaded?.isLocked(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);

    // Even the correct password is rejected while locked - and does not reset the counter.
    await expect(
      useCase.execute({ email: "admin@example.com", password: "correct-horse-battery-staple" }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
    const stillLocked = await users.findById(user.id);
    expect(stillLocked?.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
  });

  it("rejects a SUSPENDED user even with the correct password", async () => {
    const { useCase, users, user, clock } = await setup();
    const suspended = AdminUser.reconstitute({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      passwordHash: user.passwordHash,
      status: AdminUserStatus.SUSPENDED,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: clock.now(),
      updatedAt: clock.now(),
    });
    await users.save(suspended);

    await expect(
      useCase.execute({ email: "admin@example.com", password: "correct-horse-battery-staple" }),
    ).rejects.toThrow(InvalidAdminCredentialsError);
  });

  describe("timing side-channel mitigation (locked/suspended accounts)", () => {
    // Regression tests: `!user.canAttemptLogin(now)` used to throw immediately for a locked or
    // SUSPENDED account without ever running Argon2id (verify() is only reachable past this guard),
    // making both paths measurably faster than "wrong password on an active account" - letting an
    // attacker distinguish "this account exists and is locked/suspended" from "this account exists,
    // is active, and I guessed wrong" by response latency alone. AdminUserStatus has exactly two
    // values (ACTIVE, SUSPENDED - see admin-user-status.ts), and canAttemptLogin's only two false
    // conditions are status !== ACTIVE (i.e. SUSPENDED) or isLocked(now) - no other AdminUser state
    // exists, so these two cases are exhaustive. No timing/millisecond assertions here - see the
    // sibling "unknown email vs wrong password" describe block above for the same rationale.

    it("Test A - locked account: never calls verify(), calls verifyDummy() exactly once, rejects, and leaves failedLoginAttempts/lockedUntil/lastLoginAt/sessions untouched", async () => {
      const { useCase, hasher, users, sessions, user, clock } = await setup();
      const lockedUntil = new Date(clock.now().getTime() + 5 * 60 * 1000);
      const locked = AdminUser.reconstitute({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        status: AdminUserStatus.ACTIVE,
        failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil,
        lastLoginAt: null,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await users.save(locked);

      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");
      const usersSaveSpy = jest.spyOn(users, "save");
      const sessionsSaveSpy = jest.spyOn(sessions, "save");

      await expect(
        useCase.execute({ email: "admin@example.com", password: "irrelevant-wrong-password" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);

      expect(verifyDummySpy).toHaveBeenCalledTimes(1);
      expect(verifyDummySpy).toHaveBeenCalledWith("irrelevant-wrong-password");
      expect(verifySpy).not.toHaveBeenCalled();
      expect(usersSaveSpy).not.toHaveBeenCalled();
      expect(sessionsSaveSpy).not.toHaveBeenCalled();

      const reloaded = await users.findById(user.id);
      expect(reloaded?.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
      expect(reloaded?.lockedUntil).toEqual(lockedUntil);
      expect(reloaded?.lastLoginAt).toBeNull();
    });

    it("Test B - SUSPENDED account: never calls verify(), calls verifyDummy() exactly once, rejects, and makes no AdminUser/session changes", async () => {
      const { useCase, hasher, users, sessions, user, clock } = await setup();
      const suspended = AdminUser.reconstitute({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        status: AdminUserStatus.SUSPENDED,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await users.save(suspended);

      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");
      const usersSaveSpy = jest.spyOn(users, "save");
      const sessionsSaveSpy = jest.spyOn(sessions, "save");

      await expect(
        useCase.execute({ email: "admin@example.com", password: "irrelevant-wrong-password" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);

      expect(verifyDummySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).not.toHaveBeenCalled();
      expect(usersSaveSpy).not.toHaveBeenCalled();
      expect(sessionsSaveSpy).not.toHaveBeenCalled();
    });

    it("Test C - correct password presented against a locked account: still calls verifyDummy() (never verify()), still rejects, does not implicitly unlock or authenticate", async () => {
      const { useCase, hasher, users, sessions, user, clock } = await setup();
      const lockedUntil = new Date(clock.now().getTime() + 5 * 60 * 1000);
      const locked = AdminUser.reconstitute({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        status: AdminUserStatus.ACTIVE,
        failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
        lockedUntil,
        lastLoginAt: null,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      });
      await users.save(locked);

      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");
      const sessionsSaveSpy = jest.spyOn(sessions, "save");

      // The password that WOULD be correct if the account were attemptable.
      await expect(
        useCase.execute({ email: "admin@example.com", password: "correct-horse-battery-staple" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);

      expect(verifyDummySpy).toHaveBeenCalledTimes(1);
      expect(verifySpy).not.toHaveBeenCalled();
      expect(sessionsSaveSpy).not.toHaveBeenCalled();

      const reloaded = await users.findById(user.id);
      expect(reloaded?.lockedUntil).toEqual(lockedUntil);
      expect(reloaded?.failedLoginAttempts).toBe(MAX_FAILED_LOGIN_ATTEMPTS);
    });

    it("Test D - every rejection path (nonexistent, locked, suspended, active+wrong) and the success path (active+correct) each run exactly one costly verification", async () => {
      const { useCase, hasher, users, user, clock } = await setup();
      const verifySpy = jest.spyOn(hasher, "verify");
      const verifyDummySpy = jest.spyOn(hasher, "verifyDummy");
      const callCount = () => verifySpy.mock.calls.length + verifyDummySpy.mock.calls.length;
      const reset = () => {
        verifySpy.mockClear();
        verifyDummySpy.mockClear();
      };

      await expect(
        useCase.execute({ email: "nobody@example.com", password: "whatever-12345" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
      expect(callCount()).toBe(1);
      reset();

      const lockedUntil = new Date(clock.now().getTime() + 5 * 60 * 1000);
      await users.save(
        AdminUser.reconstitute({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          status: AdminUserStatus.ACTIVE,
          failedLoginAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
          lockedUntil,
          lastLoginAt: null,
          createdAt: clock.now(),
          updatedAt: clock.now(),
        }),
      );
      await expect(
        useCase.execute({ email: "admin@example.com", password: "whatever-12345" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
      expect(callCount()).toBe(1);
      reset();

      await users.save(
        AdminUser.reconstitute({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          status: AdminUserStatus.SUSPENDED,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: clock.now(),
          updatedAt: clock.now(),
        }),
      );
      await expect(
        useCase.execute({ email: "admin@example.com", password: "whatever-12345" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
      expect(callCount()).toBe(1);
      reset();

      // Restore to a plain active, unlocked account for the remaining two paths.
      await users.save(
        AdminUser.reconstitute({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          status: AdminUserStatus.ACTIVE,
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
          createdAt: clock.now(),
          updatedAt: clock.now(),
        }),
      );

      await expect(
        useCase.execute({ email: "admin@example.com", password: "totally-wrong-password" }),
      ).rejects.toThrow(InvalidAdminCredentialsError);
      expect(callCount()).toBe(1);
      reset();

      await useCase.execute({
        email: "admin@example.com",
        password: "correct-horse-battery-staple",
      });
      expect(callCount()).toBe(1);
    });
  });

  it("a successful login resets failedLoginAttempts and stamps lastLoginAt", async () => {
    const { useCase, users, user } = await setup();

    await expect(
      useCase.execute({ email: "admin@example.com", password: "wrong-password-here" }),
    ).rejects.toThrow(InvalidAdminCredentialsError);

    await useCase.execute({ email: "admin@example.com", password: "correct-horse-battery-staple" });

    const reloaded = await users.findById(user.id);
    expect(reloaded?.failedLoginAttempts).toBe(0);
    expect(reloaded?.lastLoginAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
  });
});
