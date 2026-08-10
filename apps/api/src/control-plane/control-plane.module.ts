import { Module } from "@nestjs/common";
import { CustomerManagementModule } from "@pos-cloud/customer-management";
import { InstallationsModule } from "@pos-cloud/installations";
import { LicensingModule } from "@pos-cloud/licensing";
import { CrossContextPortsModule } from "./cross-context-ports.module";

/**
 * Composition root for the Control Plane bounded contexts. CustomerManagementModule and
 * LicensingModule are also imported (again) by CrossContextPortsModule - both are static NestJS
 * modules, so Nest deduplicates them by class reference; this is the standard, safe pattern for
 * sharing a module between multiple importers.
 */
@Module({
  imports: [
    CrossContextPortsModule,
    CustomerManagementModule,
    LicensingModule,
    InstallationsModule,
  ],
})
export class ControlPlaneModule {}
