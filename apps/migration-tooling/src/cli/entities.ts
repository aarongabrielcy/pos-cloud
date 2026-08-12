import {
  AdminRoleRecord,
  AdminSessionRecord,
  AdminUserRecord,
  AdminUserRoleRecord,
  PermissionRecord,
  RolePermissionRecord,
} from "@pos-cloud/access-management/dist/persistence-entities";
import { CustomerRecord } from "@pos-cloud/customer-management/dist/persistence-entities";
import {
  InstallationCredentialRecord,
  InstallationEnrollmentRecord,
  InstallationRecord,
} from "@pos-cloud/installations/dist/persistence-entities";
import {
  LicenseEntitlementRecord,
  LicenseRecord,
} from "@pos-cloud/licensing/dist/persistence-entities";

/**
 * The one place in this repository that imports every bounded context's real TypeORM persistence
 * records together, so `migration:generate` can diff real entity metadata against PostgreSQL.
 * Each bounded context's public index.ts deliberately excludes these (see its own
 * persistence-entities.ts comment) - ordinary consumers (apps/api, other bounded contexts) must
 * never depend on persistence internals, and apps/api itself relies on `autoLoadEntities` instead.
 * This package exists solely as that one documented, deliberate exception; it is never imported by
 * apps/api or apps/worker, and @pos-cloud/database itself stays free of any bounded-context
 * dependency (see ../../README.md).
 */
export const controlPlaneEntities = [
  CustomerRecord,
  LicenseRecord,
  LicenseEntitlementRecord,
  InstallationRecord,
  InstallationEnrollmentRecord,
  InstallationCredentialRecord,
  AdminUserRecord,
  AdminSessionRecord,
  AdminUserRoleRecord,
  PermissionRecord,
  AdminRoleRecord,
  RolePermissionRecord,
];
