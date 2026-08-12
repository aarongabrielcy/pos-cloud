import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import type { AuthConfig } from "@pos-cloud/config";
import { AdminSession } from "../../domain/admin-session";
import { FixedClock } from "../../test-support/fixed-clock";
import { JwtAccessTokenAdapter } from "./jwt-access-token.adapter";

const authConfig: AuthConfig = {
  jwt: { secret: "s".repeat(64), issuer: "pos-cloud", audience: "pos-cloud-admin" },
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  refreshCookieName: "pos_cloud_admin_refresh",
  secureCookies: false,
};

function buildAdapter(config: AuthConfig = authConfig): JwtAccessTokenAdapter {
  return new JwtAccessTokenAdapter(new JwtService(), config);
}

describe("JwtAccessTokenAdapter", () => {
  it("issues a token that verifies back to the same claims", async () => {
    const adapter = buildAdapter();
    const issued = await adapter.issue({ sub: "admin-1", sid: "session-1" });

    expect(issued.expiresInSeconds).toBe(900);

    const verified = await adapter.verify(issued.token);
    expect(verified).toEqual({ adminUserId: "admin-1", sessionId: "session-1" });
  });

  it("returns null for a token signed with a different secret", async () => {
    const adapter = buildAdapter();
    const issued = await adapter.issue({ sub: "admin-1", sid: "session-1" });

    const otherAdapter = buildAdapter({
      ...authConfig,
      jwt: { ...authConfig.jwt, secret: "t".repeat(64) },
    });
    await expect(otherAdapter.verify(issued.token)).resolves.toBeNull();
  });

  it("returns null for a malformed token", async () => {
    const adapter = buildAdapter();
    await expect(adapter.verify("not-a-jwt")).resolves.toBeNull();
  });

  it("returns null for an expired token", async () => {
    const adapter = buildAdapter({ ...authConfig, accessTokenTtlSeconds: -1 });
    const issued = await adapter.issue({ sub: "admin-1", sid: "session-1" });

    await expect(adapter.verify(issued.token)).resolves.toBeNull();
  });

  it("returns null for a token issued with a different audience", async () => {
    const adapter = buildAdapter({
      ...authConfig,
      jwt: { ...authConfig.jwt, audience: "other-audience" },
    });
    const issued = await adapter.issue({ sub: "admin-1", sid: "session-1" });

    const verifier = buildAdapter();
    await expect(verifier.verify(issued.token)).resolves.toBeNull();
  });

  it("returns null for a token issued with a different issuer", async () => {
    // Same mechanism as the audience test above (jwtService.verifyAsync's `issuer` option), but not
    // previously covered by its own test - see CLOUD-01C-A's /auth/me inspection.
    const adapter = buildAdapter({
      ...authConfig,
      jwt: { ...authConfig.jwt, issuer: "some-other-issuer" },
    });
    const issued = await adapter.issue({ sub: "admin-1", sid: "session-1" });

    const verifier = buildAdapter();
    await expect(verifier.verify(issued.token)).resolves.toBeNull();
  });

  it("returns null for a correctly-signed token whose typ claim is not admin_access", async () => {
    // adapter.issue() always sets typ itself, so it cannot produce this token - sign it directly
    // with the same JwtService/options to exercise JwtAccessTokenAdapter.verify()'s own typ check
    // (see that method's `claims.typ !== TOKEN_TYPE` branch), which is application code, not
    // something the JWT library validates for us.
    const adapter = buildAdapter();
    const jwtService = new JwtService();
    const foreignTypeToken = await jwtService.signAsync(
      { sub: "admin-1", sid: "session-1", typ: "installation_access" },
      {
        secret: authConfig.jwt.secret,
        issuer: authConfig.jwt.issuer,
        audience: authConfig.jwt.audience,
        expiresIn: authConfig.accessTokenTtlSeconds,
        algorithm: "HS256",
      },
    );

    await expect(adapter.verify(foreignTypeToken)).resolves.toBeNull();
  });

  it("verifies successfully for a sid belonging to an already-revoked AdminSession - access tokens are not tied to session state until exp", async () => {
    // Documents/protects the architectural decision in docs/architecture/admin-authentication.md
    // ("Already-issued access tokens are not proactively invalidated; their maximum remaining
    // lifetime (15 minutes) bounds the exposure window"). JwtAccessTokenAdapter's constructor takes
    // only JwtService + AuthConfig (see this file's own buildAdapter()) - there is no
    // AdminSessionRepository to query, so this is proven by using a real, genuinely-revoked
    // AdminSession domain object as the sid source and confirming verify() never consults it: the
    // token authenticates purely from its own JWT claims, regardless of session.isRevoked().
    const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
    const session = AdminSession.create(
      {
        id: randomUUID(),
        adminUserId: "admin-1",
        refreshTokenHash: "irrelevant-for-this-test",
        expiresAt: new Date("2026-01-08T00:00:00.000Z"),
      },
      clock,
    );
    session.revoke(clock); // simulates rotation/logout/replay-mitigation revocation
    expect(session.isRevoked()).toBe(true);

    const adapter = buildAdapter();
    const issued = await adapter.issue({ sub: "admin-1", sid: session.id.toString() });

    await expect(adapter.verify(issued.token)).resolves.toEqual({
      adminUserId: "admin-1",
      sessionId: session.id.toString(),
    });
  });
});
