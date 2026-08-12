import { randomUUID } from "node:crypto";
import { RandomUuidGenerator } from "@pos-cloud/shared-kernel";
import { FixedClock } from "../../test-support/fixed-clock";
import { License } from "../../domain/license";
import { LicenseEdition } from "../../domain/license-edition";
import { LicenseModel } from "../../domain/license-model";
import { LicenseEntitlementMapper, LicenseMapper } from "./license.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));
const idGenerator = new RandomUuidGenerator();

describe("LicenseMapper", () => {
  it("round-trips a License (with entitlements) through toRecord/toDomain", () => {
    const original = License.create(
      {
        id: randomUUID(),
        customerId: randomUUID(),
        licenseNumber: "LIC-GST-00001",
        edition: LicenseEdition.PREMIUM,
        licenseModel: LicenseModel.SUBSCRIPTION,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2027-01-01T00:00:00.000Z"),
        maxInstallations: 5,
        entitlements: [
          { code: "integrated_payments", enabled: true, configuration: { foo: "bar" } },
        ],
      },
      clock,
      idGenerator,
    );

    const record = LicenseMapper.toRecord(original);
    const entitlementRecords = original.entitlements.map(LicenseEntitlementMapper.toRecord);
    const rehydrated = LicenseMapper.toDomain(record, entitlementRecords);

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.licenseNumber.equals(original.licenseNumber)).toBe(true);
    expect(rehydrated.edition).toBe(original.edition);
    expect(rehydrated.licenseModel).toBe(original.licenseModel);
    expect(rehydrated.validUntil).toEqual(original.validUntil);
    expect(rehydrated.entitlements).toHaveLength(1);
    expect(rehydrated.entitlements[0]?.configuration).toEqual({ foo: "bar" });
  });

  it("defaults to an empty entitlements array when omitted (list views)", () => {
    const original = License.create(
      {
        id: randomUUID(),
        customerId: randomUUID(),
        licenseNumber: "LIC-GST-00002",
        edition: LicenseEdition.BASIC,
        licenseModel: LicenseModel.PERPETUAL,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        maxInstallations: 1,
      },
      clock,
      idGenerator,
    );

    const rehydrated = LicenseMapper.toDomain(LicenseMapper.toRecord(original));

    expect(rehydrated.entitlements).toHaveLength(0);
  });
});
