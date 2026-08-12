import { Module } from "@nestjs/common";
import { AccessManagementModule } from "@pos-cloud/access-management";
import { CustomerManagementModule } from "@pos-cloud/customer-management";
import { InstallationsModule } from "@pos-cloud/installations";
import { LicensingModule } from "@pos-cloud/licensing";
import { AuthConfigModule } from "../auth/auth-config.module";
import { CrossContextPortsModule } from "./cross-context-ports.module";

/**
 * Composition root for the Control Plane bounded contexts. CustomerManagementModule and
 * LicensingModule are also imported (again) by CrossContextPortsModule - both are static NestJS
 * modules, so Nest deduplicates them by class reference; this is the standard, safe pattern for
 * sharing a module between multiple importers. AccessManagementModule (CLOUD-01C-A: admin identity
 * + authentication) does not need any cross-context port yet - see docs/architecture/
 * admin-authentication.md - so it is imported directly here rather than through
 * CrossContextPortsModule. AuthConfigModule (@Global()) supplies AUTH_CONFIG.
 */
@Module({
  imports: [
    AuthConfigModule,
    CrossContextPortsModule,
    CustomerManagementModule,
    LicensingModule,
    InstallationsModule,
    AccessManagementModule,
  ],
})
export class ControlPlaneModule {}
