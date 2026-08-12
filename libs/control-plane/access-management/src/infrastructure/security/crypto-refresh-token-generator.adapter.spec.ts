import { CryptoRefreshTokenGenerator } from "./crypto-refresh-token-generator.adapter";

describe("CryptoRefreshTokenGenerator", () => {
  const generator = new CryptoRefreshTokenGenerator();

  it("generates a base64url secret with >= 256 bits of entropy (32 raw bytes)", () => {
    const secret = generator.generateSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(secret, "base64url").length).toBe(32);
  });

  it("generates a different secret on every call", () => {
    expect(generator.generateSecret()).not.toBe(generator.generateSecret());
  });

  it("hashSecret is deterministic for the same input", () => {
    const secret = generator.generateSecret();
    expect(generator.hashSecret(secret)).toBe(generator.hashSecret(secret));
  });

  it("hashSecret never returns the raw secret", () => {
    const secret = generator.generateSecret();
    expect(generator.hashSecret(secret)).not.toBe(secret);
  });

  it("hashSecret produces a 64-char lowercase hex SHA-256 digest", () => {
    const digest = generator.hashSecret("fixed-input-for-this-test");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
