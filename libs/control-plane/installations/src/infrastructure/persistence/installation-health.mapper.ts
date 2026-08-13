import type { InstallationHealthSnapshot } from "../../application/ports/installation-health-reader.port";
import type { InstallationHealthRecord } from "./installation-health.record";

export class InstallationHealthMapper {
  static toSnapshot(record: InstallationHealthRecord): InstallationHealthSnapshot {
    return {
      firstSeenAt: record.firstSeenAt,
      lastSeenAt: record.lastSeenAt,
      appVersion: record.appVersion,
      clientReportedAt: record.clientReportedAt,
    };
  }
}
