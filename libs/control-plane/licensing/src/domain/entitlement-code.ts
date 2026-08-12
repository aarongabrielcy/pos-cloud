import { InvalidEntitlementCodeError } from "./license.errors";

const ENTITLEMENT_CODE_PATTERN = /^[a-z][a-z0-9_]{2,99}$/;

/**
 * snake_case entitlement code, e.g. `integrated_payments`, `cloud_backup`, `advanced_monitoring`,
 * `commerce_sync`, `multi_device`, `multi_branch`. No global feature catalog exists yet - any
 * string matching the pattern is accepted; the catalog of known codes is documented, not enforced.
 */
export class EntitlementCode {
  private constructor(private readonly value: string) {}

  static create(raw: string): EntitlementCode {
    if (!ENTITLEMENT_CODE_PATTERN.test(raw)) {
      throw new InvalidEntitlementCodeError(raw);
    }

    return new EntitlementCode(raw);
  }

  static reconstitute(value: string): EntitlementCode {
    return new EntitlementCode(value);
  }

  toString(): string {
    return this.value;
  }

  equals(other: EntitlementCode): boolean {
    return this.value === other.value;
  }
}
