import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * TypeORM persistence record for `access_management.permissions`. Metadata-only: nothing queries
 * this table via a repository at runtime (TypeOrmPermissionResolverAdapter reads the effective
 * permission set with a raw join, never through this entity) - it exists so `migration:generate`
 * has real entity metadata for this table and never proposes dropping it as unknown. The catalog
 * itself lives in code (see domain/permission.ts); this table only mirrors it for FK integrity.
 */
@Entity({ name: "permissions", schema: "access_management" })
export class PermissionRecord {
  @PrimaryColumn({ type: "varchar", length: 100 })
  code!: string;

  @Column({ type: "varchar", length: 255 })
  description!: string;

  @Column({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
