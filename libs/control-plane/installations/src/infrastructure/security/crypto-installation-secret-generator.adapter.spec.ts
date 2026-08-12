import { CryptoInstallationSecretGenerator } from "./crypto-installation-secret-generator.adapter";

describe("CryptoInstallationSecretGenerator", () => {
  it("generates a secret with at least 256 bits of entropy (32 raw bytes, base64url-encoded)", () => {
    const generator = new CryptoInstallationSecretGenerator();

    const secret = generator.generateSecret();

    // base64url of 32 bytes is 43 chars (no padding).
    expect(secret.length).toBeGreaterThanOrEqual(43);
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates a different secret every call", () => {
    const generator = new CryptoInstallationSecretGenerator();

    const secrets = new Set(Array.from({ length: 20 }, () => generator.generateSecret()));

    expect(secrets.size).toBe(20);
  });

  it("hashes to a 64-char lowercase hex SHA-256 digest", () => {
    const generator = new CryptoInstallationSecretGenerator();

    const hash = generator.hashSecret("some-secret");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashSecret is deterministic", () => {
    const generator = new CryptoInstallationSecretGenerator();

    expect(generator.hashSecret("same-input")).toBe(generator.hashSecret("same-input"));
  });

  it("secretMatchesHash is true for the matching secret/hash pair", () => {
    const generator = new CryptoInstallationSecretGenerator();
    const secret = generator.generateSecret();

    expect(generator.secretMatchesHash(secret, generator.hashSecret(secret))).toBe(true);
  });

  it("secretMatchesHash is false for a wrong secret", () => {
    const generator = new CryptoInstallationSecretGenerator();
    const secret = generator.generateSecret();
    const hash = generator.hashSecret(secret);

    expect(generator.secretMatchesHash("wrong-secret", hash)).toBe(false);
  });

  it("secretMatchesHash is false (not a thrown error) when hash length differs from the computed digest", () => {
    const generator = new CryptoInstallationSecretGenerator();

    expect(generator.secretMatchesHash("any-secret", "too-short")).toBe(false);
  });
});
