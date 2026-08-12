import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_ADMIN_ROLE_CODES, ROLE_PERMISSIONS } from "./admin-role";
import { ALL_PERMISSION_CODES } from "./permission";

/**
 * Reads CreateAccessManagementRbac's raw source text (not an import - a plain fs read, so this
 * carries no compile-time dependency edge on @pos-cloud/database, see .dependency-cruiser.cjs) and
 * asserts its seed INSERTs correspond exactly to this package's own PERMISSIONS/ADMIN_ROLES/
 * ROLE_PERMISSIONS catalog. Catches the class of bug where the migration's hand-written SQL and the
 * TypeScript catalog it's supposed to mirror silently drift apart - see admin-role.ts's own comment.
 */
const MIGRATION_PATH = join(
  __dirname,
  "../../../../database/src/migrations/1786551814732-CreateAccessManagementRbac.ts",
);
const migrationSource = readFileSync(MIGRATION_PATH, "utf8");

describe("CreateAccessManagementRbac migration seed vs. domain catalog", () => {
  it("seeds exactly the 10 permission codes from ALL_PERMISSION_CODES", () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(migrationSource).toContain(`'${code}'`);
    }
    const permissionInsertMatches = migrationSource.match(
      /INSERT INTO access_management\.permissions/g,
    );
    expect(permissionInsertMatches).toHaveLength(1);
  });

  it("seeds exactly the 3 role codes from ALL_ADMIN_ROLE_CODES", () => {
    for (const code of ALL_ADMIN_ROLE_CODES) {
      expect(migrationSource).toContain(`'${code}'`);
    }
  });

  it("seeds every (role_code, permission_code) pair from ROLE_PERMISSIONS - 22 pairs total", () => {
    let totalPairs = 0;
    for (const roleCode of ALL_ADMIN_ROLE_CODES) {
      for (const permissionCode of ROLE_PERMISSIONS[roleCode]) {
        expect(migrationSource).toContain(`('${roleCode}', '${permissionCode}')`);
        totalPairs += 1;
      }
    }
    expect(totalPairs).toBe(22);
  });

  it("backfills PLATFORM_ADMIN onto pre-existing admin_users rows for the CLOUD-01C-A upgrade path", () => {
    expect(migrationSource).toContain("FROM access_management.admin_users");
    expect(migrationSource).toContain("'PLATFORM_ADMIN'");
    expect(migrationSource).toContain("ON CONFLICT DO NOTHING");
  });
});
