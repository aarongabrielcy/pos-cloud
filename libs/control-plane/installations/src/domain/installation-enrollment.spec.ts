import { InstallationEnrollment } from "./installation-enrollment";
import { InstallationEnrollmentId } from "./installation-enrollment-id";
import { InstallationEnrollmentPurpose } from "./installation-enrollment-purpose";
import { FixedClock } from "../test-support/fixed-clock";

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z");

function buildEnrollment(
  overrides: Partial<{ ttlSeconds: number; purpose: InstallationEnrollmentPurpose }> = {},
) {
  const clock = new FixedClock(BASE_TIME);
  const enrollment = InstallationEnrollment.issue(
    {
      id: "enrollment-1",
      installationId: "installation-1",
      purpose: overrides.purpose ?? InstallationEnrollmentPurpose.INITIAL,
      codeHash: "a".repeat(64),
      ttlSeconds: overrides.ttlSeconds ?? 900,
    },
    clock,
  );
  return { enrollment, clock };
}

describe("InstallationEnrollment", () => {
  it("issues with consumedAt/revokedAt null and expiresAt = createdAt + ttlSeconds", () => {
    const { enrollment } = buildEnrollment({ ttlSeconds: 900 });

    expect(enrollment.consumedAt).toBeNull();
    expect(enrollment.revokedAt).toBeNull();
    expect(enrollment.createdAt).toEqual(BASE_TIME);
    expect(enrollment.expiresAt).toEqual(new Date(BASE_TIME.getTime() + 900_000));
  });

  it("isConsumable is true for a fresh, unexpired enrollment", () => {
    const { enrollment } = buildEnrollment({ ttlSeconds: 900 });

    expect(enrollment.isConsumable(BASE_TIME)).toBe(true);
  });

  it("isConsumable is false once expired", () => {
    const { enrollment } = buildEnrollment({ ttlSeconds: 900 });

    const afterExpiry = new Date(BASE_TIME.getTime() + 900_001);
    expect(enrollment.isExpired(afterExpiry)).toBe(true);
    expect(enrollment.isConsumable(afterExpiry)).toBe(false);
  });

  it("isConsumable is false after markConsumed", () => {
    const { enrollment, clock } = buildEnrollment();

    enrollment.markConsumed(clock);

    expect(enrollment.isConsumed()).toBe(true);
    expect(enrollment.isConsumable(BASE_TIME)).toBe(false);
  });

  it("double markConsumed just overwrites consumedAt - callers are responsible for checking isConsumable first", () => {
    const { enrollment, clock } = buildEnrollment();

    enrollment.markConsumed(clock);
    const firstConsumedAt = enrollment.consumedAt;
    enrollment.markConsumed(clock);

    expect(enrollment.consumedAt).toEqual(firstConsumedAt);
  });

  it("isConsumable is false after revoke, even if not expired or consumed", () => {
    const { enrollment, clock } = buildEnrollment();

    enrollment.revoke(clock);

    expect(enrollment.isRevoked()).toBe(true);
    expect(enrollment.isConsumable(BASE_TIME)).toBe(false);
  });

  it("reconstitute rehydrates without re-validating", () => {
    const rehydrated = InstallationEnrollment.reconstitute({
      id: InstallationEnrollmentId.of("enrollment-1"),
      installationId: "installation-1",
      purpose: InstallationEnrollmentPurpose.RECOVERY,
      codeHash: "b".repeat(64),
      createdAt: BASE_TIME,
      expiresAt: new Date(BASE_TIME.getTime() + 1000),
      consumedAt: null,
      revokedAt: null,
    });

    expect(rehydrated.purpose).toBe(InstallationEnrollmentPurpose.RECOVERY);
  });
});
