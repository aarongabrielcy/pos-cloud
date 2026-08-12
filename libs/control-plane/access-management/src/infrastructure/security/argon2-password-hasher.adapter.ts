import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { PasswordHasherPort } from "../../application/ports/password-hasher.port";

/**
 * Argon2id, V1 parameters: memoryCost 19456 KiB (~19 MiB), timeCost 2, parallelism 1 - the
 * OWASP-recommended floor for Argon2id, never reduced for tests (see
 * docs/architecture/admin-authentication.md#password-hashing and
 * test-support/fake-password-hasher.ts, which exists precisely so tests don't pay this latency).
 */
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Precomputed once (`argon2.hash("dummy-password-never-a-real-credential-CLOUD-01C-A-timing-
 * mitigation", ARGON2_OPTIONS)`), not a secret, and never derived from a real credential or an
 * environment variable - see verifyDummy() below and PasswordHasherPort's own comment. Encoded
 * Argon2id parameters (m=19456,t=2,p=1) match ARGON2_OPTIONS exactly, so verifying against it costs
 * the same as a real verify() - that equal cost, not the hash's content, is the point.
 */
// Exported only so argon2-password-hasher.adapter.spec.ts can assert on its encoded parameters
// without re-hashing (Argon2id is deliberately slow) - never imported by Application/Domain, and
// still not a secret.
export const DUMMY_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$f1EuOnmmnU4Dll+ihC1SUA$/U5755sIi/3tY2XDjSQcac4bnqUzNncZJvHUtS17Dp0";

@Injectable()
export class Argon2PasswordHasher implements PasswordHasherPort {
  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, ARGON2_OPTIONS);
  }

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainPassword);
    } catch {
      // A corrupted/foreign-format hash must fail verification, not crash the login use case.
      return false;
    }
  }

  async verifyDummy(plainPassword: string): Promise<boolean> {
    try {
      await argon2.verify(DUMMY_HASH, plainPassword);
    } catch {
      // DUMMY_HASH is a fixed, well-formed constant - this is unreachable in practice, but kept for
      // the same defensive reason as verify() above.
    }
    return false;
  }
}
