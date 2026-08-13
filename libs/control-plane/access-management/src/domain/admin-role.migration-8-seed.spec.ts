import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSIONS } from "./permission";

/**
 * Reads ExtendAccessManagementRbacForAudit's raw source text (plain fs read, no compile-time
 * dependency edge on @pos-cloud/database - see .dependency-cruiser.cjs) and asserts its seed
 * INSERTs match exactly the one CLOUD-01C-D permission and its two role mappings. Migration #3's own
 * snapshot is protected separately by admin-role.migration-seed.spec.ts, migration #5's by
 * admin-role.migration-5-seed.spec.ts.
 */
const MIGRATION_PATH = join(
  __dirname,
  "../../../../database/src/migrations/1786580323456-ExtendAccessManagementRbacForAudit.ts",
);
const migrationSource = readFileSync(MIGRATION_PATH, "utf8");

const NEW_PERMISSION_CODES = [PERMISSIONS.AUDIT.READ] as const;

const NEW_ROLE_PERMISSION_PAIRS = [
  ["PLATFORM_OPERATOR", PERMISSIONS.AUDIT.READ],
  ["PLATFORM_ADMIN", PERMISSIONS.AUDIT.READ],
] as const;

describe("ExtendAccessManagementRbacForAudit (migration #8) seed vs. domain catalog", () => {
  it("seeds exactly the 1 new permission code", () => {
    for (const code of NEW_PERMISSION_CODES) {
      expect(migrationSource).toContain(`'${code}'`);
    }
    const permissionInsertMatches = migrationSource.match(
      /INSERT INTO access_management\.permissions/g,
    );
    expect(permissionInsertMatches).toHaveLength(1);
  });

  it("does not touch migration #3's original permissions, the audit schema, or the installations schema", () => {
    expect(migrationSource).not.toContain("CREATE TABLE");
    expect(migrationSource).not.toContain("CREATE SCHEMA");
    expect(migrationSource).not.toContain("audit.audit_events");
    expect(migrationSource).not.toContain("installations.installation");
  });

  it("seeds exactly the 2 new (role_code, permission_code) pairs", () => {
    for (const [roleCode, permissionCode] of NEW_ROLE_PERMISSION_PAIRS) {
      expect(migrationSource).toContain(`('${roleCode}', '${permissionCode}')`);
    }
    // PLATFORM_VIEWER must not receive audit.read.
    expect(migrationSource).not.toContain(`('PLATFORM_VIEWER', '${PERMISSIONS.AUDIT.READ}')`);
  });
});
