import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `access_management.admin_roles`. Metadata-only, same rationale as
 * PermissionRecord: nothing queries it via a repository at runtime in V1 (the role catalog is
 * migration-seeded and static - see domain/admin-role.ts) - it exists purely so `migration:generate`
 * has real entity metadata for this table.
 */
@Entity({ name: "admin_roles", schema: "access_management" })
export class AdminRoleRecord {
  @PrimaryColumn({ type: "varchar", length: 50 })
  code!: string;

  @Column({ type: "varchar", length: 100 })
  name!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
