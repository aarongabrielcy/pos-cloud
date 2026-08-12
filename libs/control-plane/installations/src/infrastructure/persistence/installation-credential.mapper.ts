import { InstallationCredential } from "../../domain/installation-credential";
import { InstallationCredentialId } from "../../domain/installation-credential-id";
import { InstallationCredentialRecord } from "./installation-credential.record";

export class InstallationCredentialMapper {
  static toDomain(record: InstallationCredentialRecord): InstallationCredential {
    return InstallationCredential.reconstitute({
      id: InstallationCredentialId.of(record.id),
      installationId: record.installationId,
      secretHash: record.secretHash,
      createdAt: record.createdAt,
      revokedAt: record.revokedAt,
    });
  }

  static toRecord(credential: InstallationCredential): InstallationCredentialRecord {
    const record = new InstallationCredentialRecord();
    record.id = credential.id.toString();
    record.installationId = credential.installationId;
    record.secretHash = credential.secretHash;
    record.createdAt = credential.createdAt;
    record.revokedAt = credential.revokedAt;
    return record;
  }
}
