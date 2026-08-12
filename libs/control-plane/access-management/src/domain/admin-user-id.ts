export class AdminUserId {
  private constructor(private readonly value: string) {}

  static of(value: string): AdminUserId {
    return new AdminUserId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: AdminUserId): boolean {
    return this.value === other.value;
  }
}
