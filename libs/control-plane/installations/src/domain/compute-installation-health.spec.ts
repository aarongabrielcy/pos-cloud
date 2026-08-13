import { computeInstallationHealth } from "./compute-installation-health";
import { InstallationHealthStatus } from "./installation-health-status";
import { InstallationStatus } from "./installation-status";

const NOW = new Date("2026-01-01T00:10:00.000Z");
const THRESHOLDS = { staleAfterSeconds: 120, offlineAfterSeconds: 300 };

function secondsAgo(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

describe("computeInstallationHealth", () => {
  it("PENDING with no heartbeat -> NEVER_SEEN", () => {
    expect(computeInstallationHealth(InstallationStatus.PENDING, null, NOW, THRESHOLDS)).toBe(
      InstallationHealthStatus.NEVER_SEEN,
    );
  });

  it("ACTIVE with null lastSeenAt -> NEVER_SEEN", () => {
    expect(computeInstallationHealth(InstallationStatus.ACTIVE, null, NOW, THRESHOLDS)).toBe(
      InstallationHealthStatus.NEVER_SEEN,
    );
  });

  it("ACTIVE with a recent heartbeat -> ONLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(10), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.ONLINE);
  });

  it("ACTIVE exactly at the stale boundary (age == staleAfterSeconds) -> STALE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(120), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.STALE);
  });

  it("ACTIVE just below the stale boundary -> ONLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(119), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.ONLINE);
  });

  it("ACTIVE strictly between stale and offline -> STALE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(200), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.STALE);
  });

  it("ACTIVE exactly at the offline boundary (age == offlineAfterSeconds) -> OFFLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(300), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.OFFLINE);
  });

  it("ACTIVE just below the offline boundary -> STALE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(299), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.STALE);
  });

  it("ACTIVE well past the offline boundary -> OFFLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.ACTIVE, secondsAgo(10_000), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.OFFLINE);
  });

  it("SUSPENDED with a recent heartbeat is still reported OFFLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.SUSPENDED, secondsAgo(1), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.OFFLINE);
  });

  it("SUSPENDED with no heartbeat at all -> OFFLINE (not NEVER_SEEN)", () => {
    expect(computeInstallationHealth(InstallationStatus.SUSPENDED, null, NOW, THRESHOLDS)).toBe(
      InstallationHealthStatus.OFFLINE,
    );
  });

  it("DECOMMISSIONED with a recent heartbeat is still reported OFFLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.DECOMMISSIONED, secondsAgo(1), NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.OFFLINE);
  });

  it("DECOMMISSIONED with no heartbeat at all -> OFFLINE", () => {
    expect(
      computeInstallationHealth(InstallationStatus.DECOMMISSIONED, null, NOW, THRESHOLDS),
    ).toBe(InstallationHealthStatus.OFFLINE);
  });
});
