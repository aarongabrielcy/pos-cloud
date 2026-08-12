import { randomUUID } from "node:crypto";
import { InstallationEnrollment } from "../../domain/installation-enrollment";
import { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { FixedClock } from "../../test-support/fixed-clock";
import { InstallationEnrollmentMapper } from "./installation-enrollment.mapper";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

describe("InstallationEnrollmentMapper", () => {
  it("round-trips an InstallationEnrollment through toRecord/toDomain", () => {
    const original = InstallationEnrollment.issue(
      {
        id: randomUUID(),
        installationId: randomUUID(),
        purpose: InstallationEnrollmentPurpose.RECOVERY,
        codeHash: "a".repeat(64),
        ttlSeconds: 900,
      },
      clock,
    );

    const rehydrated = InstallationEnrollmentMapper.toDomain(
      InstallationEnrollmentMapper.toRecord(original),
    );

    expect(rehydrated.id.equals(original.id)).toBe(true);
    expect(rehydrated.installationId).toBe(original.installationId);
    expect(rehydrated.purpose).toBe(InstallationEnrollmentPurpose.RECOVERY);
    expect(rehydrated.codeHash).toBe(original.codeHash);
    expect(rehydrated.expiresAt).toEqual(original.expiresAt);
    expect(rehydrated.consumedAt).toBeNull();
    expect(rehydrated.revokedAt).toBeNull();
  });

  it("preserves consumedAt/revokedAt after consumption/revocation", () => {
    const original = InstallationEnrollment.issue(
      {
        id: randomUUID(),
        installationId: randomUUID(),
        purpose: InstallationEnrollmentPurpose.INITIAL,
        codeHash: "a".repeat(64),
        ttlSeconds: 900,
      },
      clock,
    );
    original.markConsumed(clock);

    const rehydrated = InstallationEnrollmentMapper.toDomain(
      InstallationEnrollmentMapper.toRecord(original),
    );

    expect(rehydrated.consumedAt).toEqual(clock.now());
  });
});
