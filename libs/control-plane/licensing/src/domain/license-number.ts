import { InvalidLicenseNumberError } from "./license.errors";

const LICENSE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9_-]{4,79}$/;

/** Normalizes (trim + uppercase) and validates a license number: 5-80 chars, `^[A-Z0-9][A-Z0-9_-]{4,79}$`. */
export class LicenseNumber {
  private constructor(private readonly value: string) {}

  static create(raw: string): LicenseNumber {
    const normalized = raw.trim().toUpperCase();

    if (!LICENSE_NUMBER_PATTERN.test(normalized)) {
      throw new InvalidLicenseNumberError(raw);
    }

    return new LicenseNumber(normalized);
  }

  /** Rehydrates a number already known to be valid (e.g. read from PostgreSQL) - skips re-validation. */
  static reconstitute(value: string): LicenseNumber {
    return new LicenseNumber(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: LicenseNumber): boolean {
    return this.value === other.value;
  }
}
