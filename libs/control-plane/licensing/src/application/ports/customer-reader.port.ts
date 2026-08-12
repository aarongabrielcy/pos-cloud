/**
 * Licensing owns this port (per the cross-bounded-context communication rule: the consumer
 * defines and owns the port it needs). The concrete in-process adapter, calling Customer
 * Management's public application API, is wired in the composition root (apps/api) - never here.
 */
export interface CustomerSummary {
  readonly id: string;
  readonly active: boolean;
}

export interface CustomerReaderPort {
  findCustomerSummary(customerId: string): Promise<CustomerSummary | null>;
}

export const CUSTOMER_READER_PORT = Symbol("LICENSING_CUSTOMER_READER_PORT");
