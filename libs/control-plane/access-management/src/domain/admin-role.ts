import { PERMISSIONS, type PermissionCode } from "./permission";

/**
 * The complete V1 role catalog. Flat RBAC - no hierarchy, no inheritance between roles. `PLATFORM_
 * ADMIN` is a normal role with every permission assigned; nothing in the resolver or the guard
 * special-cases its name (see AdminAuthorizationGuard) - see docs/architecture/admin-rbac.md#roles.
 */
export const ADMIN_ROLES = {
  PLATFORM_VIEWER: "PLATFORM_VIEWER",
  PLATFORM_OPERATOR: "PLATFORM_OPERATOR",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
} as const;

export type AdminRoleCode = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export const ALL_ADMIN_ROLE_CODES: readonly AdminRoleCode[] = Object.values(ADMIN_ROLES);

/**
 * The role -> permission mapping is migration-seeded and static in V1 (not runtime-editable - see
 * docs/architecture/admin-rbac.md#administration-scope). This constant is the single source of
 * truth for that mapping: CreateAccessManagementRbac's seed INSERTs must match it exactly, and
 * admin-role.spec.ts asserts that correspondence so the migration file and this catalog can never
 * silently drift apart. Never read at runtime for authorization decisions - the resolver always
 * queries PostgreSQL (see TypeOrmPermissionResolverAdapter); this is fixture/reference data.
 */
export const ROLE_PERMISSIONS: Readonly<Record<AdminRoleCode, readonly PermissionCode[]>> = {
  PLATFORM_VIEWER: [
    PERMISSIONS.CUSTOMERS.READ,
    PERMISSIONS.LICENSES.READ,
    PERMISSIONS.INSTALLATIONS.READ,
  ],
  PLATFORM_OPERATOR: [
    PERMISSIONS.CUSTOMERS.READ,
    PERMISSIONS.CUSTOMERS.CREATE,
    PERMISSIONS.CUSTOMERS.STATUS_CHANGE,
    PERMISSIONS.LICENSES.READ,
    PERMISSIONS.LICENSES.CREATE,
    PERMISSIONS.LICENSES.STATUS_CHANGE,
    PERMISSIONS.INSTALLATIONS.READ,
    PERMISSIONS.INSTALLATIONS.CREATE,
    PERMISSIONS.INSTALLATIONS.STATUS_CHANGE,
  ],
  PLATFORM_ADMIN: [
    PERMISSIONS.CUSTOMERS.READ,
    PERMISSIONS.CUSTOMERS.CREATE,
    PERMISSIONS.CUSTOMERS.STATUS_CHANGE,
    PERMISSIONS.LICENSES.READ,
    PERMISSIONS.LICENSES.CREATE,
    PERMISSIONS.LICENSES.STATUS_CHANGE,
    PERMISSIONS.LICENSES.ENTITLEMENTS_MANAGE,
    PERMISSIONS.INSTALLATIONS.READ,
    PERMISSIONS.INSTALLATIONS.CREATE,
    PERMISSIONS.INSTALLATIONS.STATUS_CHANGE,
  ],
};
