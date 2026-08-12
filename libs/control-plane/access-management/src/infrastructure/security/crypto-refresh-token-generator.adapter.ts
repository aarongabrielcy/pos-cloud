import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { RefreshTokenGeneratorPort } from "../../application/ports/refresh-token-generator.port";

@Injectable()
export class CryptoRefreshTokenGenerator implements RefreshTokenGeneratorPort {
  /** 32 random bytes = 256 bits of entropy, base64url-encoded so it's safe in a cookie value and a URL-free join char (".")  can separate it from the session id. */
  generateSecret(): string {
    return randomBytes(32).toString("base64url");
  }

  /** SHA-256 is appropriate here: the secret is already high-entropy random data, not a low-entropy password - see the port's own comment. */
  hashSecret(secret: string): string {
    return createHash("sha256").update(secret).digest("hex");
  }
}
