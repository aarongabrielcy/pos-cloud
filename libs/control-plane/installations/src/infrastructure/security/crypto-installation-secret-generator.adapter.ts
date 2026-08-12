import { Injectable } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { InstallationSecretGeneratorPort } from "../../application/ports/installation-secret-generator.port";

@Injectable()
export class CryptoInstallationSecretGenerator implements InstallationSecretGeneratorPort {
  /** 32 random bytes = 256 bits of entropy, base64url-encoded so it's safe as a body/header value. */
  generateSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  /** SHA-256 is appropriate here: the secret is already high-entropy random data, not a low-entropy password. */
  hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  /** Constant-time comparison - never `===` on hashes, to avoid a timing side-channel. */
  secretMatchesHash(secret: string, hash: string): boolean {
    const candidate = Buffer.from(this.hashSecret(secret), "hex");
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(candidate, expected);
  }
}
