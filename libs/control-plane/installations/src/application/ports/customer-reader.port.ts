/** Installations owns this port - see Licensing's identically-shaped port for the same rationale. */
export interface CustomerSummary {
  readonly id: string;
  readonly active: boolean;
}

export interface CustomerReaderPort {
  findCustomerSummary(customerId: string): Promise<CustomerSummary | null>;
}

export const CUSTOMER_READER_PORT = Symbol("INSTALLATIONS_CUSTOMER_READER_PORT");
