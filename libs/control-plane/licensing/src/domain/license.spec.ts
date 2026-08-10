import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FixedClock } from "../test-support/fixed-clock";
import { License } from "./license";
import { LicenseEdition } from "./license-edition";
import { LicenseModel } from "./license-model";
import { LicenseStatus } from "./license-status";
import {
  DuplicateEntitlementCodeError,
  InvalidLicenseEditionModelError,
  InvalidLicenseStatusTransitionError,
  InvalidLicenseValidityError,
  InvalidMaxInstallationsError,
} from "./license.errors";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const idGenerator = new RandomUuidGenerator();

function basicPerpetual(overrides: Partial<Parameters<typeof License.create>[0]> = {}) {
  return License.create(
    {
      id: randomUUID(),
      customerId: randomUUID(),
      licenseNumber: "LIC-GST-00001",
      edition: LicenseEdition.BASIC,
      licenseModel: LicenseModel.PERPETUAL,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: null,
      maxInstallations: 1,
      ...overrides,
    },
    clock,
    idGenerator,
  );
}

describe("License - edition/licenseModel commercial rules", () => {
  it("accepts BASIC + PERPETUAL", () => {
    expect(() => basicPerpetual()).not.toThrow();
  });

  it("rejects BASIC + SUBSCRIPTION", () => {
    expect(() =>
      basicPerpetual({
        licenseModel: LicenseModel.SUBSCRIPTION,
        validUntil: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).toThrow(InvalidLicenseEditionModelError);
  });

  it("accepts PREMIUM + SUBSCRIPTION", () => {
    expect(() =>
      basicPerpetual({
        edition: LicenseEdition.PREMIUM,
        licenseModel: LicenseModel.SUBSCRIPTION,
        validUntil: new Date("2027-01-01T00:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  it("rejects PREMIUM + PERPETUAL", () => {
    expect(() => basicPerpetual({ edition: LicenseEdition.PREMIUM })).toThrow(
      InvalidLicenseEditionModelError,
    );
  });
});

describe("License - validity date rules", () => {
  it("requires a null validUntil for PERPETUAL", () => {
    expect(() => basicPerpetual({ validUntil: new Date("2027-01-01T00:00:00.000Z") })).toThrow(
      InvalidLicenseValidityError,
    );
  });

  it("requires a validUntil for SUBSCRIPTION", () => {
    expect(() =>
      basicPerpetual({
        edition: LicenseEdition.PREMIUM,
        licenseModel: LicenseModel.SUBSCRIPTION,
        validUntil: null,
      }),
    ).toThrow(InvalidLicenseValidityError);
  });

  it("requires validUntil to be after validFrom", () => {
    expect(() =>
      basicPerpetual({
        edition: LicenseEdition.PREMIUM,
        licenseModel: LicenseModel.SUBSCRIPTION,
        validFrom: new Date("2027-01-01T00:00:00.000Z"),
        validUntil: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toThrow(InvalidLicenseValidityError);
  });
});

describe("License - maxInstallations", () => {
  it("rejects 0", () => {
    expect(() => basicPerpetual({ maxInstallations: 0 })).toThrow(InvalidMaxInstallationsError);
  });

  it("rejects a non-integer", () => {
    expect(() => basicPerpetual({ maxInstallations: 1.5 })).toThrow(InvalidMaxInstallationsError);
  });

  it("accepts 1", () => {
    expect(() => basicPerpetual({ maxInstallations: 1 })).not.toThrow();
  });
});

describe("License - status transitions", () => {
  it("starts ACTIVE", () => {
    expect(basicPerpetual().status).toBe(LicenseStatus.ACTIVE);
  });

  it("allows ACTIVE -> SUSPENDED -> ACTIVE", () => {
    const license = basicPerpetual();
    license.changeStatus(LicenseStatus.SUSPENDED, clock);
    license.changeStatus(LicenseStatus.ACTIVE, clock);
    expect(license.status).toBe(LicenseStatus.ACTIVE);
  });

  it("REVOKED is terminal", () => {
    const license = basicPerpetual();
    license.changeStatus(LicenseStatus.REVOKED, clock);
    expect(() => license.changeStatus(LicenseStatus.ACTIVE, clock)).toThrow(
      InvalidLicenseStatusTransitionError,
    );
  });

  it("EXPIRED is terminal", () => {
    const license = basicPerpetual();
    license.changeStatus(LicenseStatus.EXPIRED, clock);
    expect(() => license.changeStatus(LicenseStatus.SUSPENDED, clock)).toThrow(
      InvalidLicenseStatusTransitionError,
    );
  });
});

describe("License.isUsable", () => {
  it("is true for an ACTIVE PERPETUAL license within its validFrom window", () => {
    const license = basicPerpetual({ validFrom: new Date("2026-01-01T00:00:00.000Z") });
    expect(license.isUsable(new Date("2026-06-01T00:00:00.000Z"))).toBe(true);
  });

  it("is true for an ACTIVE SUBSCRIPTION still within its window", () => {
    const license = basicPerpetual({
      edition: LicenseEdition.PREMIUM,
      licenseModel: LicenseModel.SUBSCRIPTION,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(license.isUsable(new Date("2026-06-01T00:00:00.000Z"))).toBe(true);
  });

  it("is false once past validUntil, even though status is still ACTIVE", () => {
    const license = basicPerpetual({
      edition: LicenseEdition.PREMIUM,
      licenseModel: LicenseModel.SUBSCRIPTION,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(license.status).toBe(LicenseStatus.ACTIVE);
    expect(license.isUsable(new Date("2027-06-01T00:00:00.000Z"))).toBe(false);
  });

  it("is false when SUSPENDED", () => {
    const license = basicPerpetual();
    license.changeStatus(LicenseStatus.SUSPENDED, clock);
    expect(license.isUsable(new Date("2026-06-01T00:00:00.000Z"))).toBe(false);
  });

  it("is false before validFrom", () => {
    const license = basicPerpetual({ validFrom: new Date("2026-06-01T00:00:00.000Z") });
    expect(license.isUsable(new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("License - entitlements at creation", () => {
  it("accepts an initial entitlement set", () => {
    const license = basicPerpetual({
      entitlements: [{ code: "integrated_payments", enabled: true, configuration: null }],
    });
    expect(license.entitlements).toHaveLength(1);
    expect(license.entitlements[0]?.code.toString()).toBe("integrated_payments");
  });
});

describe("License.replaceEntitlements", () => {
  it("rejects duplicate codes within the same request", () => {
    const license = basicPerpetual();
    expect(() =>
      license.replaceEntitlements(
        [
          { code: "integrated_payments", enabled: true },
          { code: "integrated_payments", enabled: false },
        ],
        idGenerator,
        clock,
      ),
    ).toThrow(DuplicateEntitlementCodeError);
  });

  it("replaces the entire collection wholesale", () => {
    const license = basicPerpetual({
      entitlements: [{ code: "integrated_payments", enabled: true }],
    });

    license.replaceEntitlements([{ code: "cloud_backup", enabled: true }], idGenerator, clock);

    expect(license.entitlements).toHaveLength(1);
    expect(license.entitlements[0]?.code.toString()).toBe("cloud_backup");
  });

  it("bumps updatedAt", () => {
    const license = basicPerpetual();
    const later = new FixedClock(new Date("2026-02-01T00:00:00.000Z"));

    license.replaceEntitlements([{ code: "cloud_backup", enabled: true }], idGenerator, later);

    expect(license.updatedAt).toEqual(later.now());
  });
});
