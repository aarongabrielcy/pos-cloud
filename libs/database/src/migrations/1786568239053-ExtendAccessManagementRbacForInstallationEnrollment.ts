import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-C - Installation Enrollment / Credentials / Activation.
 *
 * Extends the existing `access_management` RBAC catalog (introduced by CreateAccessManagementRbac,
 * migration #3, already executed and never modified again - see that migration's own comment and
 * this brief's section 38) with the two new permissions CLOUD-01C-C needs, and their role mappings.
 * Deliberately a separate migration from CreateInstallationEnrollmentCredentials (#4): each migration
 * in this repository touches exactly one schema/cohesive concern (see #1 control_plane, #2
 * access_management auth, #3 access_management rbac) - this one is pure access_management DML, no
 * DDL, no touch of the `installations` schema.
 *
 * Must match domain/permission.ts's PERMISSIONS.INSTALLATIONS.ENROLLMENT_MANAGE/CREDENTIALS_MANAGE
 * and domain/admin-role.ts's ROLE_PERMISSIONS exactly - admin-role.migration-5-seed.spec.ts asserts
 * this correspondence, the same way admin-role.migration-seed.spec.ts protects migration #3.
 *
 * `installations.credentials.manage` is deliberately PLATFORM_ADMIN-only, not PLATFORM_OPERATOR -
 * see docs/architecture/installation-enrollment.md#admin-permissions: revoking a live production
 * credential is a security-incident-response action with real blast radius, unlike issuing an
 * enrollment code (which both roles get, as a natural extension of PLATFORM_OPERATOR's existing
 * `installations.create` onboarding capability).
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class ExtendAccessManagementRbacForInstallationEnrollment1786568239053 implements MigrationInterface {
  name = "ExtendAccessManagementRbacForInstallationEnrollment1786568239053";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO access_management.permissions (code, description, created_at) VALUES
        ('installations.enrollment.manage', 'Issue or regenerate an installation enrollment code', now()),
        ('installations.credentials.manage', 'Revoke an installation''s active credential', now())
    `);

    await queryRunner.query(`
      INSERT INTO access_management.role_permissions (role_code, permission_code) VALUES
        ('PLATFORM_OPERATOR', 'installations.enrollment.manage'),
        ('PLATFORM_ADMIN', 'installations.enrollment.manage'),
        ('PLATFORM_ADMIN', 'installations.credentials.manage')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM access_management.role_permissions
      WHERE (role_code, permission_code) IN (
        ('PLATFORM_OPERATOR', 'installations.enrollment.manage'),
        ('PLATFORM_ADMIN', 'installations.enrollment.manage'),
        ('PLATFORM_ADMIN', 'installations.credentials.manage')
      )
    `);
    await queryRunner.query(`
      DELETE FROM access_management.permissions
      WHERE code IN ('installations.enrollment.manage', 'installations.credentials.manage')
    `);
  }
}
