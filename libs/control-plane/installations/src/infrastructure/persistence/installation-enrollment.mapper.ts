import { InstallationEnrollment } from "../../domain/installation-enrollment";
import { InstallationEnrollmentId } from "../../domain/installation-enrollment-id";
import type { InstallationEnrollmentPurpose } from "../../domain/installation-enrollment-purpose";
import { InstallationEnrollmentRecord } from "./installation-enrollment.record";

export class InstallationEnrollmentMapper {
  static toDomain(record: InstallationEnrollmentRecord): InstallationEnrollment {
    return InstallationEnrollment.reconstitute({
      id: InstallationEnrollmentId.of(record.id),
      installationId: record.installationId,
      purpose: record.purpose as InstallationEnrollmentPurpose,
      codeHash: record.codeHash,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      consumedAt: record.consumedAt,
      revokedAt: record.revokedAt,
    });
  }

  static toRecord(enrollment: InstallationEnrollment): InstallationEnrollmentRecord {
    const record = new InstallationEnrollmentRecord();
    record.id = enrollment.id.toString();
    record.installationId = enrollment.installationId;
    record.purpose = enrollment.purpose;
    record.codeHash = enrollment.codeHash;
    record.createdAt = enrollment.createdAt;
    record.expiresAt = enrollment.expiresAt;
    record.consumedAt = enrollment.consumedAt;
    record.revokedAt = enrollment.revokedAt;
    return record;
  }
}
