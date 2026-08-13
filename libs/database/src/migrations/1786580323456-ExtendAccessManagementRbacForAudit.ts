import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-D - Audit Base.
 *
 * Extends the existing `access_management` RBAC catalog (introduced by CreateAccessManagementRbac,
 * migration #3, already executed and never modified again - see that migration's own comment) with
 * the one new permission CLOUD-01C-D needs (`audit.read`), and its role mappings. Deliberately a
 * separate migration from CreateAuditCore (#6) and CreateInstallationHealth (#7): each migration in
 * this repository touches exactly one schema/cohesive concern - this one is pure access_management
 * DML, no DDL, no touch of the `audit` or `installations` schemas.
 *
 * Must match domain/permission.ts's PERMISSIONS.AUDIT.READ and domain/admin-role.ts's
 * ROLE_PERMISSIONS exactly - a dedicated seed-matching spec asserts this correspondence, the same
 * way admin-role.migration-5-seed.spec.ts protects migration #5.
 *
 * `audit.read` is deliberately excluded from PLATFORM_VIEWER: audit reveals administrative action
 * history (who suspended what, who reissued a credential) - more sensitive than the bare resource
 * READ permissions PLATFORM_VIEWER already holds. PLATFORM_OPERATOR gets it because operators are
 * the ones who'd realistically need to investigate an incident.
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class ExtendAccessManagementRbacForAudit1786580323456 implements MigrationInterface {
  name = "ExtendAccessManagementRbacForAudit1786580323456";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO access_management.permissions (code, description, created_at) VALUES
        ('audit.read', 'Read the Control Plane audit event log', now())
    `);

    await queryRunner.query(`
      INSERT INTO access_management.role_permissions (role_code, permission_code) VALUES
        ('PLATFORM_OPERATOR', 'audit.read'),
        ('PLATFORM_ADMIN', 'audit.read')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM access_management.role_permissions
      WHERE (role_code, permission_code) IN (
        ('PLATFORM_OPERATOR', 'audit.read'),
        ('PLATFORM_ADMIN', 'audit.read')
      )
    `);
    await queryRunner.query(`
      DELETE FROM access_management.permissions
      WHERE code = 'audit.read'
    `);
  }
}
