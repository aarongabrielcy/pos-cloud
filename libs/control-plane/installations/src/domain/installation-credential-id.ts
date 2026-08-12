export class InstallationCredentialId {
  private constructor(private readonly value: string) {}

  static of(value: string): InstallationCredentialId {
    return new InstallationCredentialId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: InstallationCredentialId): boolean {
    return this.value === other.value;
  }
}
