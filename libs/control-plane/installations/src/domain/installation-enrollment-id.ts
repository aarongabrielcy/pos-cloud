export class InstallationEnrollmentId {
  private constructor(private readonly value: string) {}

  static of(value: string): InstallationEnrollmentId {
    return new InstallationEnrollmentId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: InstallationEnrollmentId): boolean {
    return this.value === other.value;
  }
}
