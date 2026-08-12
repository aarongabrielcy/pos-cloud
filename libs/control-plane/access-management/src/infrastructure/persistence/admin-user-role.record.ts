import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `access_management.admin_user_roles`. Composite primary key
 * (admin_user_id, role_code) - the same pair TypeOrmAdminRoleRepository upserts with `ON CONFLICT DO
 * NOTHING`, so a duplicate assignment is a silent no-op at the database level, never an application
 * exception (see AdminRoleRepository's own comment).
 */
@Entity({ name: "admin_user_roles", schema: "access_management" })
export class AdminUserRoleRecord {
  @PrimaryColumn({ name: "admin_user_id", type: "uuid" })
  adminUserId!: string;

  @PrimaryColumn({ name: "role_code", type: "varchar", length: 50 })
  roleCode!: string;

  @Column({ name: "assigned_at", type: "timestamptz" })
  assignedAt!: Date;
}
