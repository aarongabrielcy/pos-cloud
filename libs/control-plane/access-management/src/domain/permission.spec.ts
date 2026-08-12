import { ALL_PERMISSION_CODES, PERMISSIONS } from "./permission";

const PERMISSION_CODE_FORMAT = /^[a-z]+(\.[a-z]+)+$/;

describe("permission catalog", () => {
  it("has exactly the 10 permissions required by CLOUD-01C-B", () => {
    expect(ALL_PERMISSION_CODES).toHaveLength(10);
    expect(new Set(ALL_PERMISSION_CODES).size).toBe(10);
  });

  it("every code matches the ^[a-z]+(\\.[a-z]+)+$ format mirrored by the migration's CHECK constraint", () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(code).toMatch(PERMISSION_CODE_FORMAT);
    }
  });

  it("exposes the exact codes derived from the 13 real business endpoints", () => {
    expect(new Set(ALL_PERMISSION_CODES)).toEqual(
      new Set([
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
      ]),
    );
  });

  it("PERMISSIONS.CUSTOMERS.READ resolves to the literal code (no indirection surprises)", () => {
    expect(PERMISSIONS.CUSTOMERS.READ).toBe("customers.read");
    expect(PERMISSIONS.LICENSES.ENTITLEMENTS_MANAGE).toBe("licenses.entitlements.manage");
  });
});
