export class CustomerId {
  private constructor(private readonly value: string) {}

  static of(value: string): CustomerId {
    return new CustomerId(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CustomerId): boolean {
    return this.value === other.value;
  }
}
