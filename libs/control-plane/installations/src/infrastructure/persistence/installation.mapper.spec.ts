import { randomUUID } from "node:crypto";
import { FixedClock } from "../../test-support/fixed-clock";
import { Installation } from "../../domain/installation";
import { Platform } from "../../domain/platform";
import { InstallationMapper } from "./installation.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("InstallationMapper", () => {
  it("round-trips an Installation through toRecord/toDomain", () => {
    const original = Installation.create(
      {
        id: randomUUID(),
        customerId: randomUUID(),
        licenseId: randomUUID(),
        installationCode: "POS-GST-00001",
        name: "Sucursal Principal",
        platform: Platform.WINDOWS,
      },
      clock,
    );

    const rehydrated = InstallationMapper.toDomain(InstallationMapper.toRecord(original));

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.installationCode.equals(original.installationCode)).toBe(true);
    expect(rehydrated.status).toBe(original.status);
    expect(rehydrated.registeredAt).toBeNull();
  });

  it("preserves a non-null registeredAt after activation", () => {
    const original = Installation.create(
      {
        id: randomUUID(),
        customerId: randomUUID(),
        licenseId: randomUUID(),
        installationCode: "POS-GST-00001",
        name: "Sucursal Principal",
        platform: Platform.WINDOWS,
      },
      clock,
    );
    original.activate(clock);

    const rehydrated = InstallationMapper.toDomain(InstallationMapper.toRecord(original));

    expect(rehydrated.registeredAt).toEqual(clock.now());
  });
});
