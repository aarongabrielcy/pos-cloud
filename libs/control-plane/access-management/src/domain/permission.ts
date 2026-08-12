/**
 * The complete V1 permission catalog for administrative authorization (CLOUD-01C-B). Compile-time
 * constants are the single source of truth for `@RequirePermissions(...)` - no magic strings
 * scattered across controllers, no typo can silently create an unenforceable permission. These
 * codes are mirrored 1:1 into `access_management.permissions` by the CreateAccessManagementRbac
 * migration so `role_permissions` gets real referential integrity; a permission can only ever enter
 * the system via a deploy (this file + a migration together), never via a request - see
 * docs/architecture/admin-rbac.md#permission-catalog.
 */
export const PERMISSIONS = {
  CUSTOMERS: {
    READ: "customers.read",
    CREATE: "customers.create",
    STATUS_CHANGE: "customers.status.change",
  },
  LICENSES: {
    READ: "licenses.read",
    CREATE: "licenses.create",
    STATUS_CHANGE: "licenses.status.change",
    ENTITLEMENTS_MANAGE: "licenses.entitlements.manage",
  },
  INSTALLATIONS: {
    READ: "installations.read",
    CREATE: "installations.create",
    STATUS_CHANGE: "installations.status.change",
  },
} as const;

// A naive `(typeof PERMISSIONS)[keyof typeof PERMISSIONS][keyof ...]` collapses to the KEYS common
// to every group (CUSTOMERS/LICENSES/INSTALLATIONS don't all share ENTITLEMENTS_MANAGE), silently
// dropping "licenses.entitlements.manage" from the resulting union - `keyof` of a union type is the
// intersection of each member's keys, not their union. This distributive mapped type computes each
// group's own value-union individually first (where `keyof` is safe, since each group here is a
// single concrete object type, not itself a union), then unions those results together.
type PermissionCode = {
  [
    Group in keyof typeof PERMISSIONS
  ]: (typeof PERMISSIONS)[Group][keyof (typeof PERMISSIONS)[Group]];
}[keyof typeof PERMISSIONS];
export type { PermissionCode };

/** Every known code, derived from PERMISSIONS itself - cannot drift from it by construction. */
export const ALL_PERMISSION_CODES: readonly PermissionCode[] = Object.values(PERMISSIONS).flatMap(
  (group) => Object.values(group),
) as PermissionCode[];
