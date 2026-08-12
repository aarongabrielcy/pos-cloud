/**
 * Generates and hashes/compares the high-entropy secret half of both the enrollment code and the
 * permanent credential (`<id>.<secret>` - see opaque-token-format.ts for the join/split). Deliberately
 * owned inside `installations`, not imported from `access-management`'s CryptoRefreshTokenGenerator
 * (private to that package, and installation identity must stay fully independent of admin identity -
 * see docs/architecture/installation-enrollment.md#principles) - same shape, separately implemented.
 * `generateSecret` must be cryptographically random with >= 256 bits of entropy; `hashSecret` is a
 * fast, deterministic digest (SHA-256) - these are not passwords, so Argon2id is unnecessary and
 * would only add latency to every enroll/authenticate call; `secretMatchesHash` must compare using a
 * constant-time algorithm (`crypto.timingSafeEqual`), never `===`, to avoid a hash-comparison timing
 * side-channel.
 */
export interface InstallationSecretGeneratorPort {
  generateSecret(): string;
  hashSecret(secret: string): string;
  secretMatchesHash(secret: string, hash: string): boolean;
}

export const INSTALLATION_SECRET_GENERATOR = Symbol("INSTALLATION_SECRET_GENERATOR");
