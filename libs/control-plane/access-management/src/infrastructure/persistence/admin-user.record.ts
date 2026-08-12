import { Column, Entity, PrimaryColumn } from "typeorm";
import type { AdminUserStatus } from "../../domain/admin-user-status";

/** TypeORM persistence record for `access_management.admin_users`. No foreign keys - this table owns its own identity. */
@Entity({ name: "admin_users", schema: "access_management" })
export class AdminUserRecord {
  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @Column({ type: "varchar", length: 254, unique: true })
  email!: string;

  @Column({ name: "display_name", type: "varchar", length: 150 })
  displayName!: string;

  // Never selected into a DTO/response - see AdminUserMapper/AdminMeResponseDto's own comments.
  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @Column({ type: "varchar", length: 20 })
  status!: AdminUserStatus;

  @Column({ name: "failed_login_attempts", type: "integer", default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: "locked_until", type: "timestamptz", nullable: true, default: null })
  lockedUntil!: Date | null;

  @Column({ name: "last_login_at", type: "timestamptz", nullable: true, default: null })
  lastLoginAt!: Date | null;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @Column({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
