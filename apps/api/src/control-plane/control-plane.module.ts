import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import {
  AccessManagementModule,
  AccessTokenGuard,
  AdminAuthorizationGuard,
} from "@pos-cloud/access-management";
import { CustomerManagementModule } from "@pos-cloud/customer-management";
import { InstallationAuthGuard, InstallationsModule } from "@pos-cloud/installations";
import { LicensingModule } from "@pos-cloud/licensing";
import { AuthConfigModule } from "../auth/auth-config.module";
import { InstallationAuthConfigModule } from "../auth/installation-auth-config.module";
import { CrossContextPortsModule } from "./cross-context-ports.module";

/**
 * Composition root for the Control Plane bounded contexts. CustomerManagementModule and
 * LicensingModule are also imported (again) by CrossContextPortsModule - both are static NestJS
 * modules, so Nest deduplicates them by class reference; this is the standard, safe pattern for
 * sharing a module between multiple importers. AccessManagementModule (admin identity +
 * authentication + RBAC) does not need any cross-context port - see docs/architecture/
 * admin-rbac.md#cross-context - so it is imported directly here rather than through
 * CrossContextPortsModule. AuthConfigModule (@Global()) supplies AUTH_CONFIG.
 *
 * CLOUD-01C-B: `AccessTokenGuard` then `AdminAuthorizationGuard` are registered here as global
 * `APP_GUARD`s - NestJS's `APP_GUARD` token applies globally to every controller in the whole
 * application regardless of which module declares it, so this single registration covers
 * HealthModule (marked `@Public()`, see HealthController), every auth endpoint, and all business
 * endpoints. Order is significant and is the array order below: AccessTokenGuard always runs first,
 * so a missing/invalid Bearer token always produces 401 before AdminAuthorizationGuard ever gets a
 * chance to resolve permissions and produce 403 - see rbac-protection.http.spec.ts's guard-order
 * test and docs/architecture/admin-rbac.md#guards.
 *
 * CLOUD-01C-C adds `InstallationAuthGuard` as a 3rd global guard, after the two admin guards. Both
 * admin guards skip unconditionally on `@InstallationEnrollment()`/`@InstallationAuthenticated()`
 * routes (see their own comments); InstallationAuthGuard is the mirror image - it no-ops on every
 * route except `@InstallationAuthenticated()` ones. Relative order between InstallationAuthGuard and
 * the two admin guards does not matter functionally (each only ever acts on routes the others
 * already skip), but it is registered last to keep the already-tested admin pair's relative order
 * untouched - see docs/architecture/installation-enrollment.md#guards.
 *
 * `useExisting`, not `useClass`, for all three: `useClass` would construct a brand-new instance of
 * each guard scoped to THIS module, which cannot resolve `ACCESS_TOKEN_VERIFIER`/`PERMISSION_RESOLVER`/
 * `INSTALLATION_CREDENTIAL_VERIFIER` (all deliberately private to their owning module, never
 * exported - only the guard classes themselves are). `useExisting` reuses the one instance each
 * owning module already constructed and fully wired internally, which ControlPlaneModule can see
 * because it exports the guard.
 */
@Module({
  imports: [
    AuthConfigModule,
    InstallationAuthConfigModule,
    CrossContextPortsModule,
    CustomerManagementModule,
    LicensingModule,
    InstallationsModule,
    AccessManagementModule,
  ],
  providers: [
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: AdminAuthorizationGuard },
    { provide: APP_GUARD, useExisting: InstallationAuthGuard },
  ],
})
export class ControlPlaneModule {}
