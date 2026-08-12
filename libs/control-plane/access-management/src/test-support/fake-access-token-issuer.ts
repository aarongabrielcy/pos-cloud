import type {
  AccessTokenIssuerPort,
  AccessTokenPayload,
  AccessTokenVerifierPort,
  IssuedAccessToken,
  VerifiedAccessToken,
} from "../application/ports/access-token.port";

/**
 * Test double for AccessTokenIssuerPort/AccessTokenVerifierPort - encodes the payload as JSON, no
 * signature, no expiry enforcement. Never used in production code (see JwtAccessTokenAdapter for
 * the real implementation).
 */
export class FakeAccessTokenIssuer implements AccessTokenIssuerPort, AccessTokenVerifierPort {
  constructor(private readonly expiresInSeconds = 900) {}

  async issue(payload: AccessTokenPayload): Promise<IssuedAccessToken> {
    return {
      token: `fake.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.token`,
      expiresInSeconds: this.expiresInSeconds,
    };
  }

  async verify(token: string): Promise<VerifiedAccessToken | null> {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "fake" || parts[2] !== "token") {
      return null;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString(),
      ) as AccessTokenPayload;
      return { adminUserId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }
}
