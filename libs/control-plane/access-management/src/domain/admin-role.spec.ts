import { ALL_ADMIN_ROLE_CODES, ROLE_PERMISSIONS } from "./admin-role";
import { ALL_PERMISSION_CODES } from "./permission";

describe("admin-role catalog", () => {
  it("has exactly the 3 roles required by CLOUD-01C-B", () => {
    expect([...ALL_ADMIN_ROLE_CODES].sort()).toEqual(
      ["PLATFORM_ADMIN", "PLATFORM_OPERATOR", "PLATFORM_VIEWER"].sort(),
    );
  });

  it("gives PLATFORM_VIEWER exactly the 3 read permissions", () => {
    expect(new Set(ROLE_PERMISSIONS.PLATFORM_VIEWER)).toEqual(
      new Set(["customers.read", "licenses.read", "installations.read"]),
    );
  });

  it("gives PLATFORM_OPERATOR every permission except licenses.entitlements.manage", () => {
    expect(ROLE_PERMISSIONS.PLATFORM_OPERATOR).not.toContain("licenses.entitlements.manage");
    expect(ROLE_PERMISSIONS.PLATFORM_OPERATOR).toHaveLength(9);
  });

  it("gives PLATFORM_ADMIN every known permission - no hardcoded role-name bypass exists to check instead", () => {
    expect(new Set(ROLE_PERMISSIONS.PLATFORM_ADMIN)).toEqual(new Set(ALL_PERMISSION_CODES));
  });

  it("never assigns a permission code that isn't in the catalog", () => {
    for (const roleCode of ALL_ADMIN_ROLE_CODES) {
      for (const permissionCode of ROLE_PERMISSIONS[roleCode]) {
        expect(ALL_PERMISSION_CODES).toContain(permissionCode);
      }
    }
  });
});
