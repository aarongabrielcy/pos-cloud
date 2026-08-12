import type { PasswordHasherPort } from "../application/ports/password-hasher.port";

/** Test double for PasswordHasherPort - trivial reversible "hash", never used in production code. */
export class FakePasswordHasher implements PasswordHasherPort {
  private static readonly PREFIX = "fake-hash:";

  async hash(plainPassword: string): Promise<string> {
    return `${FakePasswordHasher.PREFIX}${plainPassword}`;
  }

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    return hash === `${FakePasswordHasher.PREFIX}${plainPassword}`;
  }

  /** Trivial-cost stand-in for the real adapter's Argon2id dummy verify - always resolves false. */
  async verifyDummy(_plainPassword: string): Promise<boolean> {
    return false;
  }
}
