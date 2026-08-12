/**
 * Generates and hashes the opaque refresh token *secret* half (the raw cookie value is
 * `<sessionId>.<secret>`, assembled by the use case - see docs/architecture/
 * admin-authentication.md#opaque-refresh-token). `generateSecret` must be cryptographically random
 * with >= 256 bits of entropy; `hashSecret` is a fast, deterministic digest (SHA-256) - this is not
 * a password, so Argon2id is unnecessary and would only add latency to every refresh call.
 */
export interface RefreshTokenGeneratorPort {
  generateSecret(): string;
  hashSecret(secret: string): string;
}

export const REFRESH_TOKEN_GENERATOR = Symbol("REFRESH_TOKEN_GENERATOR");
