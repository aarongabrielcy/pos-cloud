import { Injectable } from "@nestjs/common";
import { CustomerStatus, GetCustomerByIdUseCase } from "@pos-cloud/customer-management";

interface CustomerSummary {
  readonly id: string;
  readonly active: boolean;
}

/**
 * In-process adapter implementing BOTH Licensing's and Installations' `CustomerReaderPort` (they
 * are structurally identical, each bounded context owning its own copy of the interface - see
 * ADR-010/control-plane-core.md). Lives in the composition root, never inside a bounded context
 * package: it is the only place allowed to depend on Customer Management's public application API
 * on behalf of another context.
 */
@Injectable()
export class CustomerReaderAdapter {
  constructor(private readonly getCustomerById: GetCustomerByIdUseCase) {}

  async findCustomerSummary(customerId: string): Promise<CustomerSummary | null> {
    const customer = await this.getCustomerById.execute(customerId);
    if (!customer) {
      return null;
    }
    return { id: customer.id.toString(), active: customer.status === CustomerStatus.ACTIVE };
  }
}
