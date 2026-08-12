import type { Clock } from "@pos-cloud/shared-kernel";
import { EntitlementCode } from "./entitlement-code";
import { InvalidEntitlementConfigurationError } from "./license.errors";

export interface LicenseEntitlementProps {
  id: string;
  licenseId: string;
  code: EntitlementCode;
  enabled: boolean;
  configuration: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLicenseEntitlementInput {
  id: string;
  licenseId: string;
  code: string;
  enabled: boolean;
  configuration?: Record<string, unknown> | null;
}

/**
 * Child entity of the License aggregate - never persisted, loaded, or mutated independently of
 * its owning License. Represents a technical capability, not a commercial package: edition is
 * what the customer bought, entitlements are what is technically switched on.
 */
export class LicenseEntitlement {
  private constructor(private props: LicenseEntitlementProps) {}

  static create(input: CreateLicenseEntitlementInput, clock: Clock): LicenseEntitlement {
    validateConfiguration(input.configuration);
    const now = clock.now();

    return new LicenseEntitlement({
      id: input.id,
      licenseId: input.licenseId,
      code: EntitlementCode.create(input.code),
      enabled: input.enabled,
      configuration: input.configuration ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: LicenseEntitlementProps): LicenseEntitlement {
    return new LicenseEntitlement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get licenseId(): string {
    return this.props.licenseId;
  }

  get code(): EntitlementCode {
    return this.props.code;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get configuration(): Record<string, unknown> | null {
    return this.props.configuration;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function validateConfiguration(configuration: unknown): void {
  if (configuration === undefined || configuration === null) {
    return;
  }
  if (typeof configuration !== "object" || Array.isArray(configuration)) {
    throw new InvalidEntitlementConfigurationError();
  }
}
