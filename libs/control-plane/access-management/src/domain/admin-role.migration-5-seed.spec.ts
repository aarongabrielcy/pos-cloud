import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSIONS } from "./permission";

/**
 * Reads ExtendAccessManagementRbacForInstallationEnrollment's raw source text (plain fs read, no
 * compile-time dependency edge on @pos-cloud/database - see .dependency-cruiser.cjs) and asserts its
 * seed INSERTs match exactly the two CLOUD-01C-C permissions and their three role mappings. Migration
 * #3's own snapshot is protected separately by admin-role.migration-seed.spec.ts.
 */
const MIGRATION_PATH = join(
  __dirname,
  "../../../../database/src/migrations/1786568239053-ExtendAccessManagementRbacForInstallationEnrollment.ts",
);
const migrationSource = readFileSync(MIGRATION_PATH, "utf8");

const NEW_PERMISSION_CODES = [
  PERMISSIONS.INSTALLATIONS.ENROLLMENT_MANAGE,
  PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE,
] as const;

const NEW_ROLE_PERMISSION_PAIRS = [
  ["PLATFORM_OPERATOR", PERMISSIONS.INSTALLATIONS.ENROLLMENT_MANAGE],
  ["PLATFORM_ADMIN", PERMISSIONS.INSTALLATIONS.ENROLLMENT_MANAGE],
  ["PLATFORM_ADMIN", PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE],
] as const;

describe("ExtendAccessManagementRbacForInstallationEnrollment (migration #5) seed vs. domain catalog", () => {
  it("seeds exactly the 2 new permission codes", () => {
    for (const code of NEW_PERMISSION_CODES) {
      expect(migrationSource).toContain(`'${code}'`);
    }
    const permissionInsertMatches = migrationSource.match(
      /INSERT INTO access_management\.permissions/g,
    );
    expect(permissionInsertMatches).toHaveLength(1);
  });

  it("does not touch migration #3's original permissions or the installations schema", () => {
    expect(migrationSource).not.toContain("CREATE TABLE");
    expect(migrationSource).not.toContain("installations.installation");
  });

  it("seeds exactly the 3 new (role_code, permission_code) pairs", () => {
    for (const [roleCode, permissionCode] of NEW_ROLE_PERMISSION_PAIRS) {
      expect(migrationSource).toContain(`('${roleCode}', '${permissionCode}')`);
    }
    // PLATFORM_VIEWER and PLATFORM_OPERATOR must not receive credentials.manage.
    expect(migrationSource).not.toContain(
      `('PLATFORM_VIEWER', '${PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE}')`,
    );
    expect(migrationSource).not.toContain(
      `('PLATFORM_OPERATOR', '${PERMISSIONS.INSTALLATIONS.CREDENTIALS_MANAGE}')`,
    );
  });
});
