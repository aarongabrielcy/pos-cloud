import { createHash, randomBytes } from "node:crypto";
import type { RefreshTokenGeneratorPort } from "../application/ports/refresh-token-generator.port";

/** Test double for RefreshTokenGeneratorPort - same algorithm shape as the real adapter, kept here so tests don't depend on infrastructure. */
export class FakeRefreshTokenGenerator implements RefreshTokenGeneratorPort {
  generateSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }
}
