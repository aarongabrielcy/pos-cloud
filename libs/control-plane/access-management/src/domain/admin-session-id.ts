export class AdminSessionId {
  private constructor(private readonly value: string) {}

  static of(value: string): AdminSessionId {
    return new AdminSessionId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminSessionId): boolean {
    return this.value === other.value;
  }
}
