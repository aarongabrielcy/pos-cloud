import { InvalidAdminPasswordError } from "./admin-user.errors";

const MIN_LENGTH = 12;
const MAX_LENGTH = 256;

/**
 * Transient holder for a raw (plaintext) admin password, validated once at the point a password is
 * set (bootstrap only, in CLOUD-01C-A - no self-service change/recovery flow exists yet). Never
 * persisted, logged, or included in an error message. Only length is policed (12-256 chars) -
 * deliberately no forced-composition rules (uppercase/digit/symbol), see
 * docs/architecture/admin-authentication.md#password-policy for the rationale.
 */
export class Password {
  private constructor(private readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < MIN_LENGTH) {
      throw new InvalidAdminPasswordError(`must be at least ${MIN_LENGTH} characters`);
    }
    if (raw.length > MAX_LENGTH) {
      throw new InvalidAdminPasswordError(`must be at most ${MAX_LENGTH} characters`);
    }

    return new Password(raw);
  }

  reveal(): string {
    return this.value;
  }
}
