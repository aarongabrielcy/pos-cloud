import { AdminUser } from "../../domain/admin-user";
import { AdminUserId } from "../../domain/admin-user-id";
import type { AdminUserStatus } from "../../domain/admin-user-status";
import { Email } from "../../domain/email";
import { AdminUserRecord } from "./admin-user.record";

export class AdminUserMapper {
  static toDomain(record: AdminUserRecord): AdminUser {
    return AdminUser.reconstitute({
      id: AdminUserId.of(record.id),
      email: Email.reconstitute(record.email),
      displayName: record.displayName,
      passwordHash: record.passwordHash,
      status: record.status as AdminUserStatus,
      failedLoginAttempts: record.failedLoginAttempts,
      lockedUntil: record.lockedUntil,
      lastLoginAt: record.lastLoginAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toRecord(user: AdminUser): AdminUserRecord {
    const record = new AdminUserRecord();
    record.id = user.id.toString();
    record.email = user.email.toString();
    record.displayName = user.displayName;
    record.passwordHash = user.passwordHash;
    record.status = user.status;
    record.failedLoginAttempts = user.failedLoginAttempts;
    record.lockedUntil = user.lockedUntil;
    record.lastLoginAt = user.lastLoginAt;
    record.createdAt = user.createdAt;
    record.updatedAt = user.updatedAt;
    return record;
  }
}
