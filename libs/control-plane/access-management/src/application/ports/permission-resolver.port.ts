import type { PermissionCode } from "../../domain/permission";

/**
 * Resolves an AdminUser's effective permissions (the union across every role assigned to them) in
 * a single query, evaluated fresh on every call - no caching, no JWT embedding (see docs/
 * architecture/admin-rbac.md#jwt-vs-db-lookup). A SUSPENDED AdminUser must resolve to an empty set,
 * not throw and not skip the check - see TypeOrmPermissionResolverAdapter's own comment.
 */
export interface PermissionResolverPort {
  resolveEffectivePermissions(adminUserId: string): Promise<ReadonlySet<PermissionCode>>;
}

export const PERMISSION_RESOLVER = Symbol("PERMISSION_RESOLVER");
