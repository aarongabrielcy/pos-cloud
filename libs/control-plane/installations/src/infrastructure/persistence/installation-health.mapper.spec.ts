import { InstallationHealthMapper } from "./installation-health.mapper";
import { InstallationHealthRecord } from "./installation-health.record";

describe("InstallationHealthMapper", () => {
  it("maps a record to a snapshot", () => {
    const record = new InstallationHealthRecord();
    record.installationId = "installation-1";
    record.firstSeenAt = new Date("2026-01-01T00:00:00.000Z");
    record.lastSeenAt = new Date("2026-01-01T00:05:00.000Z");
    record.clientReportedAt = new Date("2026-01-01T00:04:59.000Z");
    record.appVersion = "1.4.2";

    expect(InstallationHealthMapper.toSnapshot(record)).toEqual({
      firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
      lastSeenAt: new Date("2026-01-01T00:05:00.000Z"),
      appVersion: "1.4.2",
      clientReportedAt: new Date("2026-01-01T00:04:59.000Z"),
    });
  });

  it("maps a null clientReportedAt through unchanged", () => {
    const record = new InstallationHealthRecord();
    record.installationId = "installation-1";
    record.firstSeenAt = new Date("2026-01-01T00:00:00.000Z");
    record.lastSeenAt = new Date("2026-01-01T00:00:00.000Z");
    record.clientReportedAt = null;
    record.appVersion = "1.4.2";

    expect(InstallationHealthMapper.toSnapshot(record).clientReportedAt).toBeNull();
  });
});
