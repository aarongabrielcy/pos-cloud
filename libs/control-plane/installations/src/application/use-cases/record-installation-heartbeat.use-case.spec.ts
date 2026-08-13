import type { Clock } from "@pos-cloud/shared-kernel";
import type { InstallationHealthWriterPort } from "../ports/installation-health-writer.port";
import { RecordInstallationHeartbeatUseCase } from "./record-installation-heartbeat.use-case";

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

function fixedClock(): Clock {
  return { now: () => FIXED_NOW };
}

function fakeWriter() {
  return {
    recordHeartbeat: jest.fn().mockResolvedValue(undefined),
  } satisfies InstallationHealthWriterPort;
}

describe("RecordInstallationHeartbeatUseCase", () => {
  it("records a heartbeat using the server clock as receivedAt, never a client-supplied time", async () => {
    const writer = fakeWriter();
    const useCase = new RecordInstallationHeartbeatUseCase(writer, fixedClock());

    await useCase.execute({
      installationId: "installation-1",
      appVersion: "1.4.2",
      clientReportedAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(writer.recordHeartbeat).toHaveBeenCalledWith({
      installationId: "installation-1",
      receivedAt: FIXED_NOW,
      appVersion: "1.4.2",
      clientReportedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
  });

  it("passes a null clientReportedAt through unchanged when omitted", async () => {
    const writer = fakeWriter();
    const useCase = new RecordInstallationHeartbeatUseCase(writer, fixedClock());

    await useCase.execute({
      installationId: "installation-1",
      appVersion: "1.4.2",
      clientReportedAt: null,
    });

    expect(writer.recordHeartbeat).toHaveBeenCalledWith(
      expect.objectContaining({ clientReportedAt: null }),
    );
  });
});
