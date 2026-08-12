import { AdminSession } from "../../domain/admin-session";
import { AdminSessionId } from "../../domain/admin-session-id";
import { AdminSessionRecord } from "./admin-session.record";

export class AdminSessionMapper {
  static toDomain(record: AdminSessionRecord): AdminSession {
    return AdminSession.reconstitute({
      id: AdminSessionId.of(record.id),
      adminUserId: record.adminUserId,
      refreshTokenHash: record.refreshTokenHash,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      replacedBySessionId: record.replacedBySessionId
        ? AdminSessionId.of(record.replacedBySessionId)
        : null,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
    });
  }

  static toRecord(session: AdminSession): AdminSessionRecord {
    const record = new AdminSessionRecord();
    record.id = session.id.toString();
    record.adminUserId = session.adminUserId;
    record.refreshTokenHash = session.refreshTokenHash;
    record.expiresAt = session.expiresAt;
    record.revokedAt = session.revokedAt;
    record.replacedBySessionId = session.replacedBySessionId?.toString() ?? null;
    record.createdAt = session.createdAt;
    record.lastUsedAt = session.lastUsedAt;
    return record;
  }
}
