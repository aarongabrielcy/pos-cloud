import { InvalidCustomerCodeError } from "./customer.errors";

const CUSTOMER_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,49}$/;

/** Normalizes (trim + uppercase) and validates a customer code: 3-50 chars, `^[A-Z0-9][A-Z0-9_-]{2,49}$`. */
export class CustomerCode {
  private constructor(private readonly value: string) {}

  static create(raw: string): CustomerCode {
    const normalized = raw.trim().toUpperCase();

    if (!CUSTOMER_CODE_PATTERN.test(normalized)) {
      throw new InvalidCustomerCodeError(raw);
    }

    return new CustomerCode(normalized);
  }

  /** Rehydrates a code already known to be valid (e.g. read from PostgreSQL) - skips re-validation. */
  static reconstitute(value: string): CustomerCode {
    return new CustomerCode(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CustomerCode): boolean {
    return this.value === other.value;
  }
}
