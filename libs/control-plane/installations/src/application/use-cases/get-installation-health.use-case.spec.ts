import { randomUUID } from "node:crypto";
import type { InstallationHealthConfig } from "@pos-cloud/config";
import type { Clock } from "@pos-cloud/shared-kernel";
import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationHealthStatus } from "../../domain/installation-health-status";
import { InstallationId } from "../../domain/installation-id";
import type { InstallationRepository } from "../../domain/installation-repository.port";
import { InstallationStatus } from "../../domain/installation-status";
import { Platform } from "../../domain/platform";
import type {
  InstallationHealthReaderPort,
  InstallationHealthSnapshot,
} from "../ports/installation-health-reader.port";
import { GetInstallationHealthUseCase } from "./get-installation-health.use-case";

const FIXED_NOW = new Date("2026-01-01T00:10:00.000Z");
const CONFIG: InstallationHealthConfig = {
  heartbeatIntervalSeconds: 60,
  staleAfterSeconds: 120,
  offlineAfterSeconds: 300,
};

function fixedClock(): Clock {
  return { now: () => FIXED_NOW };
}

function buildInstallation(status: InstallationStatus): Installation {
  return Installation.reconstitute({
    id: InstallationId.of("installation-1"),
    customerId: randomUUID(),
    licenseId: randomUUID(),
    installationCode: InstallationCode.create("POS-GST-00001"),
    name: "Test",
    platform: Platform.WINDOWS,
    status,
    registeredAt: status === InstallationStatus.PENDING ? null : FIXED_NOW,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
}

function fakeRepository(installation: Installation | null): InstallationRepository {
  return {
    findById: jest.fn().mockResolvedValue(installation),
    findByCode: jest.fn(),
    save: jest.fn(),
    list: jest.fn(),
    countNonDecommissionedByLicense: jest.fn(),
  };
}

function fakeHealthReader(
  snapshot: InstallationHealthSnapshot | null,
): InstallationHealthReaderPort {
  return { findByInstallationId: jest.fn().mockResolvedValue(snapshot) };
}

describe("GetInstallationHealthUseCase", () => {
  it("returns null when the installation does not exist", async () => {
    const useCase = new GetInstallationHealthUseCase(
      fakeRepository(null),
      fakeHealthReader(null),
      CONFIG,
      fixedClock(),
    );

    await expect(useCase.execute("missing")).resolves.toBeNull();
  });

  it("reports NEVER_SEEN with all health fields null when no heartbeat row exists yet", async () => {
    const useCase = new GetInstallationHealthUseCase(
      fakeRepository(buildInstallation(InstallationStatus.ACTIVE)),
      fakeHealthReader(null),
      CONFIG,
      fixedClock(),
    );

    const result = await useCase.execute("installation-1");

    expect(result).toEqual({
      installationId: "installation-1",
      lifecycleStatus: InstallationStatus.ACTIVE,
      healthStatus: InstallationHealthStatus.NEVER_SEEN,
      lastSeenAt: null,
      firstSeenAt: null,
      appVersion: null,
      clientReportedAt: null,
    });
  });

  it("computes ONLINE via the shared pure function for a recent heartbeat on an ACTIVE installation", async () => {
    const snapshot: InstallationHealthSnapshot = {
      firstSeenAt: new Date("2025-12-01T00:00:00.000Z"),
      lastSeenAt: new Date(FIXED_NOW.getTime() - 5_000),
      appVersion: "1.4.2",
      clientReportedAt: null,
    };
    const useCase = new GetInstallationHealthUseCase(
      fakeRepository(buildInstallation(InstallationStatus.ACTIVE)),
      fakeHealthReader(snapshot),
      CONFIG,
      fixedClock(),
    );

    const result = await useCase.execute("installation-1");

    expect(result?.healthStatus).toBe(InstallationHealthStatus.ONLINE);
    expect(result?.appVersion).toBe("1.4.2");
    expect(result?.firstSeenAt).toEqual(snapshot.firstSeenAt);
  });

  it("reports OFFLINE for SUSPENDED even with a very recent heartbeat", async () => {
    const snapshot: InstallationHealthSnapshot = {
      firstSeenAt: new Date("2025-12-01T00:00:00.000Z"),
      lastSeenAt: new Date(FIXED_NOW.getTime() - 1_000),
      appVersion: "1.4.2",
      clientReportedAt: null,
    };
    const useCase = new GetInstallationHealthUseCase(
      fakeRepository(buildInstallation(InstallationStatus.SUSPENDED)),
      fakeHealthReader(snapshot),
      CONFIG,
      fixedClock(),
    );

    const result = await useCase.execute("installation-1");

    expect(result?.healthStatus).toBe(InstallationHealthStatus.OFFLINE);
    expect(result?.lifecycleStatus).toBe(InstallationStatus.SUSPENDED);
  });
});
