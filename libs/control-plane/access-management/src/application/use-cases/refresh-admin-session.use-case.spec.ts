import type { AuthConfig } from "@pos-cloud/config";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { AdminSession } from "../../domain/admin-session";
import { AdminSessionId } from "../../domain/admin-session-id";
import { InvalidRefreshTokenError } from "../../domain/admin-session.errors";
import { FakeAccessTokenIssuer } from "../../test-support/fake-access-token-issuer";
import { FakeRefreshTokenGenerator } from "../../test-support/fake-refresh-token-generator";
import { FixedClock } from "../../test-support/fixed-clock";
import { InMemoryAdminSessionStore } from "../../test-support/in-memory-admin-session-store";
import { RefreshAdminSessionUseCase } from "./refresh-admin-session.use-case";

const authConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

async function setup() {
  const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
  const sessions = new InMemoryAdminSessionStore();
  const tokenIssuer = new FakeAccessTokenIssuer();
  const refreshGenerator = new FakeRefreshTokenGenerator();
  const idGenerator = new RandomUuidGenerator();

  const useCase = new RefreshAdminSessionUseCase(
    sessions,
    refreshGenerator,
    tokenIssuer,
    clock,
    idGenerator,
    authConfig,
  );

  const adminUserId = idGenerator.next();
  const sessionId = idGenerator.next();
  const secret = refreshGenerator.generateSecret();
  const session = AdminSession.create(
    {
      id: sessionId,
      adminUserId,
      refreshTokenHash: refreshGenerator.hashSecret(secret),
      expiresAt: new Date(clock.now().getTime() + authConfig.refreshTokenTtlSeconds * 1000),
    },
    clock,
  );
  await sessions.save(session);

  return {
    clock,
    sessions,
    tokenIssuer,
    refreshGenerator,
    useCase,
    adminUserId,
    sessionId,
    secret,
  };
}

describe("RefreshAdminSessionUseCase", () => {
  it("rotates: issues a new access token and a new refresh token, revoking the old session", async () => {
    const { useCase, sessions, sessionId, secret } = await setup();

    const result = await useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` });

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken.sessionId).not.toBe(sessionId);

    const oldSession = await sessions.findById(AdminSessionId.of(sessionId));
    expect(oldSession?.isRevoked()).toBe(true);
    expect(oldSession?.replacedBySessionId?.toString()).toBe(result.refreshToken.sessionId);

    const newSession = await sessions.findById(AdminSessionId.of(result.refreshToken.sessionId));
    expect(newSession).not.toBeNull();
    expect(newSession?.isActive(new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("rejects a malformed token (no separator)", async () => {
    const { useCase } = await setup();
    await expect(useCase.execute({ rawRefreshToken: "not-a-valid-token" })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it("rejects an unknown sessionId", async () => {
    const { useCase } = await setup();
    await expect(
      useCase.execute({ rawRefreshToken: "00000000-0000-4000-8000-000000000000.some-secret" }),
    ).rejects.toThrow(InvalidRefreshTokenError);
  });

  it("rejects a wrong secret for a known sessionId", async () => {
    const { useCase, sessionId } = await setup();
    await expect(useCase.execute({ rawRefreshToken: `${sessionId}.wrong-secret` })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it("rejects an expired session", async () => {
    const { sessions, sessionId, secret, refreshGenerator, tokenIssuer, adminUserId } =
      await setup();
    const expiredClock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    // Overwrite with an already-expired session for the same id/secret.
    const expired = AdminSession.create(
      {
        id: sessionId,
        adminUserId,
        refreshTokenHash: refreshGenerator.hashSecret(secret),
        expiresAt: new Date(expiredClock.now().getTime() - 1000),
      },
      expiredClock,
    );
    await sessions.save(expired);
    const idGenerator = new RandomUuidGenerator();
    const useCase = new RefreshAdminSessionUseCase(
      sessions,
      refreshGenerator,
      tokenIssuer,
      expiredClock,
      idGenerator,
      authConfig,
    );

    await expect(useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it("rejects reuse of an already-rotated (revoked) token - double refresh", async () => {
    const { useCase, sessionId, secret } = await setup();

    await useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` });

    await expect(useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` })).rejects.toThrow(
      InvalidRefreshTokenError,
    );
  });

  it("replay after rotation revokes every other active session for the same AdminUser, and that revocation survives the 401 (does not get rolled back)", async () => {
    // Regression test for a real production incident: mass revocation happened, but the query
    // used to throw InvalidRefreshTokenError INSIDE the unitOfWork.runExclusive callback - which
    // wraps a real PostgreSQL transaction (dataSource.transaction()), rolling back every mutation
    // made during it, including the revocation itself. PostgreSQL then correctly showed every
    // other session still active. This only fails now because InMemoryAdminSessionStore.runExclusive
    // models real commit/rollback (see that file's own comment) - a fake that mutates its store
    // unconditionally cannot catch this class of bug, which is exactly how this test passed before
    // while production was broken. Fails again if InvalidRefreshTokenError is ever thrown back
    // inside the transactional callback instead of after runExclusive resolves.
    const { useCase, sessions, sessionId, secret, adminUserId, clock, refreshGenerator } =
      await setup();

    // A second, unrelated active session for the same admin user.
    const otherSecret = refreshGenerator.generateSecret();
    const idGenerator = new RandomUuidGenerator();
    const otherSessionId = idGenerator.next();
    const otherSession = AdminSession.create(
      {
        id: otherSessionId,
        adminUserId,
        refreshTokenHash: refreshGenerator.hashSecret(otherSecret),
        expiresAt: new Date(clock.now().getTime() + authConfig.refreshTokenTtlSeconds * 1000),
      },
      clock,
    );
    await sessions.save(otherSession);

    // Legitimate rotation.
    const first = await useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` });

    // Replay of the now-revoked original token.
    await expect(useCase.execute({ rawRefreshToken: `${sessionId}.${secret}` })).rejects.toThrow(
      InvalidRefreshTokenError,
    );

    const other = await sessions.findById(AdminSessionId.of(otherSessionId));
    expect(other?.isRevoked()).toBe(true);

    // Even the freshly rotated session gets swept up (mass revocation is per-AdminUser, not
    // per-session) - see RefreshAdminSessionUseCase's replay-mitigation comment.
    const rotated = await sessions.findById(AdminSessionId.of(first.refreshToken.sessionId));
    expect(rotated?.isRevoked()).toBe(true);
  });
});
