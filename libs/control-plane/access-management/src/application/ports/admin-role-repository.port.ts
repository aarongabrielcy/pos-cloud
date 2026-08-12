import type { AdminRoleCode } from "../../domain/admin-role";

/**
 * Write-side of role assignment. Deliberately minimal: no `removeRole`/`listRoles` method exists
 * yet because nothing calls them - see AssignRoleToAdminUseCase's own comment and docs/architecture/
 * admin-rbac.md#administration-scope. Add them when a real consumer needs them, not before.
 */
export interface AdminRoleRepository {
  /**
   * Idempotent: assigning a role the AdminUser already has must not throw and must not create a
   * duplicate row - implementations must use `INSERT ... ON CONFLICT DO NOTHING` (or the TypeORM
   * equivalent), never a try/catch around a unique-violation, since a caught unique violation still
   * leaves the surrounding PostgreSQL transaction aborted - see TypeOrmAdminRoleRepository.
   */
  assignRole(adminUserId: string, roleCode: AdminRoleCode, assignedAt: Date): Promise<void>;
}

export const ADMIN_ROLE_REPOSITORY = Symbol("ADMIN_ROLE_REPOSITORY");
