import { InvalidInstallationCodeError } from "./installation.errors";

const INSTALLATION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{4,79}$/;

/** Normalizes (trim + uppercase) and validates: 5-80 chars, `^[A-Z0-9][A-Z0-9_-]{4,79}$` (same shape as LicenseNumber). */
export class InstallationCode {
  private constructor(private readonly value: string) {}

  static create(raw: string): InstallationCode {
    const normalized = raw.trim().toUpperCase();

    if (!INSTALLATION_CODE_PATTERN.test(normalized)) {
      throw new InvalidInstallationCodeError(raw);
    }

    return new InstallationCode(normalized);
  }

  static reconstitute(value: string): InstallationCode {
    return new InstallationCode(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: InstallationCode): boolean {
    return this.value === other.value;
  }
}
