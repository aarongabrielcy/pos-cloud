import { randomUUID } from "node:crypto";
import { FixedClock } from "../test-support/fixed-clock";
import { Installation } from "./installation";
import { InstallationStatus } from "./installation-status";
import { InvalidInstallationStatusTransitionError } from "./installation.errors";
import { Platform } from "./platform";

const clock = new FixedClock(new Date("2026-01-01T00:00:00.000Z"));

function createInstallation() {
  return Installation.create(
    {
      id: randomUUID(),
      customerId: randomUUID(),
      licenseId: randomUUID(),
      installationCode: "pos-gst-00001",
      name: "Sucursal Principal",
      platform: Platform.WINDOWS,
    },
    clock,
  );
}

describe("Installation", () => {
  it("starts PENDING with a null registeredAt", () => {
    const installation = createInstallation();
    expect(installation.status).toBe(InstallationStatus.PENDING);
    expect(installation.registeredAt).toBeNull();
  });

  it("normalizes installationCode", () => {
    expect(createInstallation().installationCode.toString()).toBe("POS-GST-00001");
  });

  describe("changeStatus (administrative)", () => {
    it("rejects PENDING -> ACTIVE", () => {
      const installation = createInstallation();
      expect(() => installation.changeStatus(InstallationStatus.ACTIVE, clock)).toThrow(
        InvalidInstallationStatusTransitionError,
      );
    });

    it("allows PENDING -> DECOMMISSIONED", () => {
      const installation = createInstallation();
      installation.changeStatus(InstallationStatus.DECOMMISSIONED, clock);
      expect(installation.status).toBe(InstallationStatus.DECOMMISSIONED);
    });

    it("allows ACTIVE -> SUSPENDED -> ACTIVE via activate() + changeStatus()", () => {
      const installation = createInstallation();
      installation.activate(clock);
      installation.changeStatus(InstallationStatus.SUSPENDED, clock);
      installation.changeStatus(InstallationStatus.ACTIVE, clock);
      expect(installation.status).toBe(InstallationStatus.ACTIVE);
    });

    it("DECOMMISSIONED is terminal", () => {
      const installation = createInstallation();
      installation.changeStatus(InstallationStatus.DECOMMISSIONED, clock);
      expect(() => installation.changeStatus(InstallationStatus.ACTIVE, clock)).toThrow(
        InvalidInstallationStatusTransitionError,
      );
    });
  });

  describe("activate (reserved for CLOUD-01C, not wired to any use case)", () => {
    it("transitions PENDING -> ACTIVE and stamps registeredAt", () => {
      const installation = createInstallation();
      const activationClock = new FixedClock(new Date("2026-02-01T00:00:00.000Z"));

      installation.activate(activationClock);

      expect(installation.status).toBe(InstallationStatus.ACTIVE);
      expect(installation.registeredAt).toEqual(activationClock.now());
    });

    it("rejects activation from a non-PENDING status", () => {
      const installation = createInstallation();
      installation.activate(clock);

      expect(() => installation.activate(clock)).toThrow(InvalidInstallationStatusTransitionError);
    });
  });
});
