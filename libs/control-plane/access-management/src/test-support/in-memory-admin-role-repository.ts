import type { AdminRoleRepository } from "../application/ports/admin-role-repository.port";
import type { AdminRoleCode } from "../domain/admin-role";

/**
 * Test double for AdminRoleRepository - never used in production code. Mimics the real adapter's
 * `ON CONFLICT DO NOTHING` semantics with a Set keyed on (adminUserId, roleCode): a duplicate assign
 * is a silent no-op, never a thrown error - see TypeOrmAdminRoleRepository's own comment.
 */
export class InMemoryAdminRoleRepository implements AdminRoleRepository {
  private readonly assignments = new Map<string, { roleCode: AdminRoleCode; assignedAt: Date }>();

  async assignRole(adminUserId: string, roleCode: AdminRoleCode, assignedAt: Date): Promise<void> {
    const key = `${adminUserId}:${roleCode}`;
    if (this.assignments.has(key)) {
      return;
    }
    this.assignments.set(key, { roleCode, assignedAt });
  }

  roleCodesFor(adminUserId: string): AdminRoleCode[] {
    return [...this.assignments.entries()]
      .filter(([key]) => key.startsWith(`${adminUserId}:`))
      .map(([, value]) => value.roleCode);
  }

  size(): number {
    return this.assignments.size;
  }
}
