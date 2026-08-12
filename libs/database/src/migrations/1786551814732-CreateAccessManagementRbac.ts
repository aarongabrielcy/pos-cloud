import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CLOUD-01C-B - Admin RBAC / Permissions / Control Plane Protection.
 *
 * Adds four tables to the existing `access_management` schema (introduced by
 * CreateAccessManagementAuth):
 *   - access_management.permissions       - static catalog, mirrors domain/permission.ts 1:1
 *   - access_management.admin_roles       - static catalog, mirrors domain/admin-role.ts 1:1
 *   - access_management.role_permissions  - static role -> permission mapping (not runtime-editable
 *                                            in CLOUD-01C-B - see docs/architecture/
 *                                            admin-rbac.md#administration-scope)
 *   - access_management.admin_user_roles  - the one dynamic table: which admin has which role
 *
 * `permissions`/`admin_roles`/`role_permissions` are seeded deterministically below with exactly
 * the V1 catalog (10 permissions, 3 roles, 22 mappings) - see domain/admin-role.ts's ROLE_PERMISSIONS
 * constant, the single source of truth this seed must match (admin-role.migration-seed.spec.ts
 * asserts the correspondence).
 *
 * The final INSERT backfills PLATFORM_ADMIN onto every admin_users row that already exists at
 * migration time - this repository already has exactly one (from CLOUD-01C-A's bootstrap run), and
 * without this step that admin would authenticate successfully but be unable to do anything (see
 * BootstrapFirstAdminUseCase's own comment for the complementary fresh-install path).
 *
 * Same-context FKs only (no FK crosses a schema boundary - see ADR-010): role_permissions and
 * admin_user_roles both reference tables inside this same access_management schema.
 *
 * NOT executed by this task. The user runs `pnpm migration:run` when ready.
 */
export class CreateAccessManagementRbac1786551814732 implements MigrationInterface {
  name = "CreateAccessManagementRbac1786551814732";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- access_management.permissions -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE access_management.permissions (
        code        varchar(100) PRIMARY KEY,
        description varchar(255) NOT NULL,
        created_at  timestamptz NOT NULL,
        -- Mirrors PermissionCode's own shape (domain/permission.ts): lowercase dot-separated
        -- segments, e.g. 'customers.read'.
        CONSTRAINT ck_permissions_code_format CHECK (code ~ '^[a-z]+(\\.[a-z]+)+$')
      )
    `);

    // --- access_management.admin_roles -----------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE access_management.admin_roles (
        code       varchar(50) PRIMARY KEY,
        name       varchar(100) NOT NULL,
        created_at timestamptz NOT NULL,
        -- Mirrors AdminRoleCode's own shape (domain/admin-role.ts): SCREAMING_SNAKE_CASE, e.g.
        -- 'PLATFORM_ADMIN'.
        CONSTRAINT ck_admin_roles_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$')
      )
    `);

    // --- access_management.role_permissions ------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE access_management.role_permissions (
        role_code       varchar(50) NOT NULL,
        permission_code varchar(100) NOT NULL,
        CONSTRAINT pk_role_permissions PRIMARY KEY (role_code, permission_code),
        CONSTRAINT fk_role_permissions_role_code
          FOREIGN KEY (role_code) REFERENCES access_management.admin_roles (code) ON DELETE CASCADE,
        -- RESTRICT, not CASCADE: a permission must never be silently dropped from a role mapping as
        -- a side effect of deleting the permission row itself - that requires an explicit migration.
        CONSTRAINT fk_role_permissions_permission_code
          FOREIGN KEY (permission_code) REFERENCES access_management.permissions (code)
          ON DELETE RESTRICT
      )
    `);

    // --- access_management.admin_user_roles ------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE access_management.admin_user_roles (
        admin_user_id uuid NOT NULL,
        role_code     varchar(50) NOT NULL,
        assigned_at   timestamptz NOT NULL,
        CONSTRAINT pk_admin_user_roles PRIMARY KEY (admin_user_id, role_code),
        CONSTRAINT fk_admin_user_roles_admin_user_id
          FOREIGN KEY (admin_user_id) REFERENCES access_management.admin_users (id) ON DELETE CASCADE,
        -- RESTRICT, not CASCADE: prevents deleting a role that still has admins assigned to it
        -- without an explicit unassignment first - protects against silently leaving an admin with
        -- zero roles.
        CONSTRAINT fk_admin_user_roles_role_code
          FOREIGN KEY (role_code) REFERENCES access_management.admin_roles (code) ON DELETE RESTRICT
      )
    `);
    // No index beyond the two composite primary keys above: both already serve the only lookup
    // patterns that exist today (WHERE admin_user_id = $1 in TypeOrmPermissionResolverAdapter's
    // join, WHERE role_code = $1 for a role's own permission set) via their leading PK column - see
    // docs/architecture/admin-rbac.md#data-model.

    // --- Seed: 10 permissions (must match domain/permission.ts's ALL_PERMISSION_CODES exactly) ----
    await queryRunner.query(`
      INSERT INTO access_management.permissions (code, description, created_at) VALUES
        ('customers.read', 'View customers (individual or list)', now()),
        ('customers.create', 'Create a customer', now()),
        ('customers.status.change', 'Change a customer''s status', now()),
        ('licenses.read', 'View licenses (individual or list, with entitlements)', now()),
        ('licenses.create', 'Create a license', now()),
        ('licenses.status.change', 'Change a license''s status', now()),
        ('licenses.entitlements.manage', 'Replace a license''s entitlements', now()),
        ('installations.read', 'View installations (individual or list)', now()),
        ('installations.create', 'Create an installation', now()),
        ('installations.status.change', 'Change an installation''s status', now())
    `);

    // --- Seed: 3 roles (must match domain/admin-role.ts's ALL_ADMIN_ROLE_CODES exactly) -----------
    await queryRunner.query(`
      INSERT INTO access_management.admin_roles (code, name, created_at) VALUES
        ('PLATFORM_VIEWER', 'Platform Viewer', now()),
        ('PLATFORM_OPERATOR', 'Platform Operator', now()),
        ('PLATFORM_ADMIN', 'Platform Admin', now())
    `);

    // --- Seed: 22 role_permissions mappings (must match domain/admin-role.ts's ROLE_PERMISSIONS
    //     exactly - admin-role.migration-seed.spec.ts asserts this) --------------------------------
    await queryRunner.query(`
      INSERT INTO access_management.role_permissions (role_code, permission_code) VALUES
        ('PLATFORM_VIEWER', 'customers.read'),
        ('PLATFORM_VIEWER', 'licenses.read'),
        ('PLATFORM_VIEWER', 'installations.read'),

        ('PLATFORM_OPERATOR', 'customers.read'),
        ('PLATFORM_OPERATOR', 'customers.create'),
        ('PLATFORM_OPERATOR', 'customers.status.change'),
        ('PLATFORM_OPERATOR', 'licenses.read'),
        ('PLATFORM_OPERATOR', 'licenses.create'),
        ('PLATFORM_OPERATOR', 'licenses.status.change'),
        ('PLATFORM_OPERATOR', 'installations.read'),
        ('PLATFORM_OPERATOR', 'installations.create'),
        ('PLATFORM_OPERATOR', 'installations.status.change'),

        ('PLATFORM_ADMIN', 'customers.read'),
        ('PLATFORM_ADMIN', 'customers.create'),
        ('PLATFORM_ADMIN', 'customers.status.change'),
        ('PLATFORM_ADMIN', 'licenses.read'),
        ('PLATFORM_ADMIN', 'licenses.create'),
        ('PLATFORM_ADMIN', 'licenses.status.change'),
        ('PLATFORM_ADMIN', 'licenses.entitlements.manage'),
        ('PLATFORM_ADMIN', 'installations.read'),
        ('PLATFORM_ADMIN', 'installations.create'),
        ('PLATFORM_ADMIN', 'installations.status.change')
    `);

    // --- Backfill: grant PLATFORM_ADMIN to every admin_users row that predates RBAC ----------------
    // ON CONFLICT DO NOTHING is defensive (this table was just created empty by this same migration,
    // so no real conflict can occur) - kept for the same reason AssignRoleToAdminUseCase's own
    // real-world write path always uses it: it is the correct, safe form for this statement wherever
    // it appears, including if this exact INSERT is ever re-run by hand as a repair step (see
    // BootstrapFirstAdminUseCase's own comment).
    await queryRunner.query(`
      INSERT INTO access_management.admin_user_roles (admin_user_id, role_code, assigned_at)
      SELECT id, 'PLATFORM_ADMIN', now()
      FROM access_management.admin_users
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS access_management.admin_user_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_management.role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_management.admin_roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS access_management.permissions`);
  }
}
