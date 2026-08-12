export class InstallationId {
  private constructor(private readonly value: string) {}

  static of(value: string): InstallationId {
    return new InstallationId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: InstallationId): boolean {
    return this.value === other.value;
  }
}
