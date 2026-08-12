import { Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `access_management.role_permissions`. Metadata-only, same
 * rationale as PermissionRecord/AdminRoleRecord: TypeOrmPermissionResolverAdapter reads this table
 * with a raw join (see its own comment), never through this entity - it exists purely so
 * `migration:generate` has real entity metadata for this table.
 */
@Entity({ name: "role_permissions", schema: "access_management" })
export class RolePermissionRecord {
  @PrimaryColumn({ name: "role_code", type: "varchar", length: 50 })
  roleCode!: string;

  @PrimaryColumn({ name: "permission_code", type: "varchar", length: 100 })
  permissionCode!: string;
}
