/** Claims carried by the short-lived admin access JWT. */
export interface AccessTokenPayload {
  /** AdminUser id. */
  sub: string;
  /** Current AdminSession id. */
  sid: string;
}

export interface IssuedAccessToken {
  token: string;
  expiresInSeconds: number;
}

export interface AccessTokenIssuerPort {
  issue(payload: AccessTokenPayload): Promise<IssuedAccessToken>;
}

export const ACCESS_TOKEN_ISSUER = Symbol("ACCESS_TOKEN_ISSUER");

export interface VerifiedAccessToken {
  adminUserId: string;
  sessionId: string;
}

/** Returns `null` (never throws) for any invalid/expired/malformed token - the caller (an HTTP guard) decides how to respond. */
export interface AccessTokenVerifierPort {
  verify(token: string): Promise<VerifiedAccessToken | null>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol("ACCESS_TOKEN_VERIFIER");
