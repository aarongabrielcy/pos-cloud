/**
 * Port for password hashing/verification. Domain never depends on this (or on Argon2 directly) -
 * see docs/architecture/admin-authentication.md#password-hashing for the chosen implementation and
 * parameters (infrastructure/security/argon2-password-hasher.adapter.ts).
 */
export interface PasswordHasherPort {
  hash(plainPassword: string): Promise<string>;
  verify(hash: string, plainPassword: string): Promise<boolean>;
  /**
   * Runs the same costly verification work as verify(), but against a fixed, non-secret dummy hash
   * instead of a real one - always resolves false. Exists so a login attempt against a nonexistent
   * email pays the same cost as one against a real account with a wrong password, closing the
   * timing side-channel that would otherwise let a caller distinguish the two by response latency
   * (see LoginAdminUseCase). The dummy hash itself is an implementation detail owned by whichever
   * adapter implements this port - never passed in or exposed here.
   */
  verifyDummy(plainPassword: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol("PASSWORD_HASHER");
