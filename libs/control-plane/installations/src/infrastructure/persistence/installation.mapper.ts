import { Installation } from "../../domain/installation";
import { InstallationCode } from "../../domain/installation-code";
import { InstallationId } from "../../domain/installation-id";
import type { InstallationStatus } from "../../domain/installation-status";
import type { Platform } from "../../domain/platform";
import { InstallationRecord } from "./installation.record";

export class InstallationMapper {
  static toDomain(record: InstallationRecord): Installation {
    return Installation.reconstitute({
      id: InstallationId.of(record.id),
      customerId: record.customerId,
      licenseId: record.licenseId,
      installationCode: InstallationCode.reconstitute(record.installationCode),
      name: record.name,
      platform: record.platform as Platform,
      status: record.status as InstallationStatus,
      registeredAt: record.registeredAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toRecord(installation: Installation): InstallationRecord {
    const record = new InstallationRecord();
    record.id = installation.id.toString();
    record.customerId = installation.customerId;
    record.licenseId = installation.licenseId;
    record.installationCode = installation.installationCode.toString();
    record.name = installation.name;
    record.platform = installation.platform;
    record.status = installation.status;
    record.registeredAt = installation.registeredAt;
    record.createdAt = installation.createdAt;
    record.updatedAt = installation.updatedAt;
    return record;
  }
}
