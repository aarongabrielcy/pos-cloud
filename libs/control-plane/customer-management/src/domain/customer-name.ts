import { InvalidCustomerLegalNameError, InvalidCustomerTradeNameError } from "./customer.errors";

/**
 * Trimmed, length-bounded display name. Shared shape for both `legalName` and `tradeName` (their
 * only real difference is the length floor and which error they raise), so this stays one value
 * object instead of two near-identical ones.
 */
export class CustomerName {
  private constructor(private readonly value: string) {}

  static createLegalName(raw: string): CustomerName {
    const normalized = raw.trim();
    if (normalized.length < 2 || normalized.length > 200) {
      throw new InvalidCustomerLegalNameError();
    }
    return new CustomerName(normalized);
  }

  static createTradeName(raw: string): CustomerName {
    const normalized = raw.trim();
    if (normalized.length < 1 || normalized.length > 200) {
      throw new InvalidCustomerTradeNameError();
    }
    return new CustomerName(normalized);
  }

  /** Rehydrates a name already known to be valid (e.g. read from PostgreSQL) - skips re-validation. */
  static reconstitute(value: string): CustomerName {
    return new CustomerName(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: CustomerName): boolean {
    return this.value === other.value;
  }
}
