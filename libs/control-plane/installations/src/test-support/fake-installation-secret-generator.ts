import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { InstallationSecretGeneratorPort } from "../application/ports/installation-secret-generator.port";

/** Test double for InstallationSecretGeneratorPort - same algorithm shape as the real adapter, kept here so application-layer tests don't depend on infrastructure. */
export class FakeInstallationSecretGenerator implements InstallationSecretGeneratorPort {
  generateSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }

  secretMatchesHash(secret: string, hash: string): boolean {
    const candidate = Buffer.from(this.hashSecret(secret), "hex");
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(candidate, expected);
  }
}
