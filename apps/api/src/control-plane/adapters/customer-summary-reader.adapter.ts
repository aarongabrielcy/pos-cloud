import { Injectable } from "@nestjs/common";
import { GetCustomersByIdsUseCase } from "@pos-cloud/customer-management";

interface CustomerDisplaySummary {
  readonly id: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string | null;
}

/**
 * In-process adapter implementing BOTH Licensing's and Installations' `CustomerSummaryReaderPort`
 * (structurally identical, each bounded context owning its own copy of the interface - see
 * CustomerReaderAdapter's own precedent comment). Lives in the composition root, never inside a
 * bounded context package: it is the only place allowed to depend on Customer Management's public
 * application API on behalf of another context.
 *
 * A single batched GetCustomersByIdsUseCase call per invocation - never one call per id.
 */
@Injectable()
export class CustomerSummaryReaderAdapter {
  constructor(private readonly getCustomersByIds: GetCustomersByIdsUseCase) {}

  async findByIds(ids: readonly string[]): Promise<Map<string, CustomerDisplaySummary>> {
    const customers = await this.getCustomersByIds.execute(ids);
    const summaries = new Map<string, CustomerDisplaySummary>();
    for (const customer of customers) {
      summaries.set(customer.id.toString(), {
        id: customer.id.toString(),
        code: customer.code.toString(),
        legalName: customer.legalName.toString(),
        tradeName: customer.tradeName?.toString() ?? null,
      });
    }
    return summaries;
  }
}
