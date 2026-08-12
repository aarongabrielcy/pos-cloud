import { Global, Module } from "@nestjs/common";
import { CustomerManagementModule } from "@pos-cloud/customer-management";
import {
  CUSTOMER_READER_PORT as INSTALLATIONS_CUSTOMER_READER_PORT,
  LICENSE_READER_PORT as INSTALLATIONS_LICENSE_READER_PORT,
} from "@pos-cloud/installations";
import {
  CUSTOMER_READER_PORT as LICENSING_CUSTOMER_READER_PORT,
  LicensingModule,
} from "@pos-cloud/licensing";
import { CustomerReaderAdapter } from "./adapters/customer-reader.adapter";
import { LicenseReaderAdapter } from "./adapters/license-reader.adapter";

/**
 * The single place in this repository where cross-bounded-context port bindings are wired.
 * `@Global()` so Licensing's and Installations' own use cases can `@Inject()` their ports without
 * importing this module themselves - each bounded context package stays unaware of who
 * implements the ports it depends on. See docs/architecture/control-plane-core.md.
 */
@Global()
@Module({
  imports: [CustomerManagementModule, LicensingModule],
  providers: [
    CustomerReaderAdapter,
    LicenseReaderAdapter,
    { provide: LICENSING_CUSTOMER_READER_PORT, useExisting: CustomerReaderAdapter },
    { provide: INSTALLATIONS_CUSTOMER_READER_PORT, useExisting: CustomerReaderAdapter },
    { provide: INSTALLATIONS_LICENSE_READER_PORT, useExisting: LicenseReaderAdapter },
  ],
  exports: [
    LICENSING_CUSTOMER_READER_PORT,
    INSTALLATIONS_CUSTOMER_READER_PORT,
    INSTALLATIONS_LICENSE_READER_PORT,
  ],
})
export class CrossContextPortsModule {}
