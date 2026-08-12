import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { PermissionResolverPort } from "../../application/ports/permission-resolver.port";
import { ALL_PERMISSION_CODES, type PermissionCode } from "../../domain/permission";

const KNOWN_PERMISSION_CODES = new Set<string>(ALL_PERMISSION_CODES);

interface PermissionCodeRow {
  permission_code: string;
}

/**
 * Single indexed round-trip: joins admin_user_roles -> role_permissions filtered by admin_user_id
 * AND admin_users.status = 'ACTIVE' - a SUSPENDED AdminUser resolves to an empty set from this same
 * query, not a separate check (see docs/architecture/admin-rbac.md#suspended-semantics). No N+1: one
 * query per request regardless of how many roles the admin has. No Redis - see PermissionResolverPort's
 * own comment for why resolution is always fresh.
 *
 * Uses a raw parameterized query (not the entity/repository API) because this reads across three
 * tables at once and none of `permissions`/`admin_roles`/`role_permissions` has any other runtime
 * consumer - see PermissionRecord/AdminRoleRecord/RolePermissionRecord's own comments for why those
 * entities exist purely as `migration:generate` metadata.
 */
@Injectable()
export class TypeOrmPermissionResolverAdapter implements PermissionResolverPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolveEffectivePermissions(adminUserId: string): Promise<ReadonlySet<PermissionCode>> {
    const rows: PermissionCodeRow[] = await this.dataSource.query(
      `
        SELECT DISTINCT rp.permission_code
        FROM access_management.admin_users au
        JOIN access_management.admin_user_roles aur ON aur.admin_user_id = au.id
        JOIN access_management.role_permissions rp ON rp.role_code = aur.role_code
        WHERE au.id = $1 AND au.status = 'ACTIVE'
      `,
      [adminUserId],
    );

    const result = new Set<PermissionCode>();
    for (const row of rows) {
      if (!KNOWN_PERMISSION_CODES.has(row.permission_code)) {
        // The database returned a permission code this deployed code doesn't recognize - a
        // migration/code drift that must fail loudly, never silently grant or silently drop an
        // unknown capability (see the port's own comment). Becomes a sanitized 500 via
        // AllExceptionsFilter, same as any other unexpected error.
        throw new Error(`Unknown permission code returned from database: ${row.permission_code}`);
      }
      result.add(row.permission_code as PermissionCode);
    }
    return result;
  }
}
