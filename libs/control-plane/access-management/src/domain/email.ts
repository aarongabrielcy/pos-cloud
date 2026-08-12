import { InvalidAdminEmailError } from "./admin-user.errors";

// Deliberately simple (not RFC 5322-exhaustive) - matches the level of validation used elsewhere
// in this repository's value objects (see CustomerCode/InstallationCode). Rejects the obviously
// malformed; does not attempt to fully validate every edge case of the email grammar.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes (trim + lowercase) and validates an admin email address. The canonical lowercase form
 * is what gets persisted and compared, so uniqueness is effectively case-insensitive without
 * needing a case-insensitive database index/collation.
 */
export class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length < 3 || normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
      throw new InvalidAdminEmailError();
    }

    return new Email(normalized);
  }

  static reconstitute(value: string): Email {
    return new Email(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
