export class LicenseId {
  private constructor(private readonly value: string) {}

  static of(value: string): LicenseId {
    return new LicenseId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: LicenseId): boolean {
    return this.value === other.value;
  }
}
