import { ALL_PERMISSION_CODES, PERMISSIONS } from "./permission";

const PERMISSION_CODE_FORMAT = /^[a-z]+(\.[a-z]+)+$/;

describe("permission catalog", () => {
  it("has exactly the 13 permissions (10 from CLOUD-01C-B + 2 from CLOUD-01C-C + 1 from CLOUD-01C-D)", () => {
    expect(ALL_PERMISSION_CODES).toHaveLength(13);
    expect(new Set(ALL_PERMISSION_CODES).size).toBe(13);
  });

  it("every code matches the ^[a-z]+(\\.[a-z]+)+$ format mirrored by the migrations' CHECK constraints", () => {
    for (const code of ALL_PERMISSION_CODES) {
      expect(code).toMatch(PERMISSION_CODE_FORMAT);
    }
  });

  it("exposes the exact codes derived from the 13 real business endpoints, CLOUD-01C-C's 2 enrollment/credential endpoints, and CLOUD-01C-D's audit.read", () => {
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
        "installations.enrollment.manage",
        "installations.credentials.manage",
        "audit.read",
      ]),
    );
  });

  it("PERMISSIONS.CUSTOMERS.READ resolves to the literal code (no indirection surprises)", () => {
    expect(PERMISSIONS.CUSTOMERS.READ).toBe("customers.read");
    expect(PERMISSIONS.LICENSES.ENTITLEMENTS_MANAGE).toBe("licenses.entitlements.manage");
  });
});
