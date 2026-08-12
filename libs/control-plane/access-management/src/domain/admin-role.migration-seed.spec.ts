import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads CreateAccessManagementRbac's raw source text (not an import - a plain fs read, so this
 * carries no compile-time dependency edge on @pos-cloud/database, see .dependency-cruiser.cjs) and
 * asserts its seed INSERTs correspond exactly to the ORIGINAL CLOUD-01C-B V1 catalog.
 *
 * Migration #3 is already executed and immutable (CLOUD-01C-C's brief section 38: never modify it
 * again) - so, unlike before CLOUD-01C-C, this spec no longer compares against the *current*
 * PERMISSIONS/ADMIN_ROLES/ROLE_PERMISSIONS (which now also include CLOUD-01C-C's two new
 * installation-enrollment permissions, seeded by migration #5 instead - see
 * admin-role.migration-5-seed.spec.ts). The snapshot below is deliberately hardcoded, frozen exactly
 * as migration #3 was written, so this test keeps protecting migration #3 specifically without ever
 * needing to change again itself.
 */
const MIGRATION_PATH = join(
  __dirname,
  "../../../../database/src/migrations/1786551814732-CreateAccessManagementRbac.ts",
);
const migrationSource = readFileSync(MIGRATION_PATH, "utf8");

const ORIGINAL_PERMISSION_CODES = [
  "customers.read",
  "customers.create",
  "customers.status.change",
  "licenses.read",
  "licenses.create",
  "licenses.status.change",
  "licenses.entitlements.manage",
  "installations.read",
  "installations.create",
  "installations.status.change",
] as const;

const ORIGINAL_ROLE_CODES = ["PLATFORM_VIEWER", "PLATFORM_OPERATOR", "PLATFORM_ADMIN"] as const;

const ORIGINAL_ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  PLATFORM_VIEWER: ["customers.read", "licenses.read", "installations.read"],
  PLATFORM_OPERATOR: [
    "customers.read",
    "customers.create",
    "customers.status.change",
    "licenses.read",
    "licenses.create",
    "licenses.status.change",
    "installations.read",
    "installations.create",
    "installations.status.change",
  ],
  PLATFORM_ADMIN: [
    "customers.read",
    "customers.create",
    "customers.status.change",
    "licenses.read",
    "licenses.create",
    "licenses.status.change",
    "licenses.entitlements.manage",
    "installations.read",
    "installations.create",
    "installations.status.change",
  ],
};

describe("CreateAccessManagementRbac (migration #3, immutable) seed vs. its frozen V1 snapshot", () => {
  it("seeds exactly the original 10 permission codes", () => {
    for (const code of ORIGINAL_PERMISSION_CODES) {
      expect(migrationSource).toContain(`'${code}'`);
    }
    // The two CLOUD-01C-C codes must NOT appear in this already-executed migration.
    expect(migrationSource).not.toContain("installations.enrollment.manage");
    expect(migrationSource).not.toContain("installations.credentials.manage");
    const permissionInsertMatches = migrationSource.match(
      /INSERT INTO access_management\.permissions/g,
    );
    expect(permissionInsertMatches).toHaveLength(1);
  });

  it("seeds exactly the original 3 role codes", () => {
    for (const code of ORIGINAL_ROLE_CODES) {
      expect(migrationSource).toContain(`'${code}'`);
    }
  });

  it("seeds exactly the original 22 (role_code, permission_code) pairs", () => {
    let totalPairs = 0;
    for (const roleCode of ORIGINAL_ROLE_CODES) {
      for (const permissionCode of ORIGINAL_ROLE_PERMISSIONS[roleCode]) {
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
