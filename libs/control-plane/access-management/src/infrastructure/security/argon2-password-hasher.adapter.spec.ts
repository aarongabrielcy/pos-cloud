import { DUMMY_HASH, Argon2PasswordHasher } from "./argon2-password-hasher.adapter";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();

  it("produces an Argon2id hash distinct from the plaintext", async () => {
    const hash = await hasher.hash("a-strong-enough-password");
    expect(hash).not.toBe("a-strong-enough-password");
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it("verifies a correct password against its own hash", async () => {
    const hash = await hasher.hash("a-strong-enough-password");
    await expect(hasher.verify(hash, "a-strong-enough-password")).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hasher.hash("a-strong-enough-password");
    await expect(hasher.verify(hash, "totally-different-password")).resolves.toBe(false);
  });

  it("returns false (never throws) for a malformed hash", async () => {
    await expect(hasher.verify("not-a-real-argon2-hash", "anything")).resolves.toBe(false);
  });

  describe("verifyDummy() - timing side-channel mitigation", () => {
    it("DUMMY_HASH is a syntactically valid Argon2id hash using the same parameters as ARGON2_OPTIONS (m=19456, t=2, p=1)", () => {
      // Asserted against the exported constant directly (no re-hashing here - Argon2id is
      // deliberately slow) rather than by calling hash() again, which would just recompute a new,
      // equally-valid-but-different hash and prove nothing about DUMMY_HASH itself.
      expect(DUMMY_HASH).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    });

    it("is accepted by the real Argon2 implementation (verifyDummy resolves instead of throwing) and always resolves false", async () => {
      await expect(hasher.verifyDummy("anything")).resolves.toBe(false);
      await expect(hasher.verifyDummy("")).resolves.toBe(false);
    });

    it("never matches any password, including one that happens to equal the fixed dummy plaintext", async () => {
      // DUMMY_HASH is never derived from anything a caller could plausibly send - not a real
      // credential, not sourced from an env var - so even guessing its source plaintext must fail.
      await expect(
        hasher.verifyDummy("dummy-password-never-a-real-credential-CLOUD-01C-A-timing-mitigation"),
      ).resolves.toBe(false);
    });
  });
});
