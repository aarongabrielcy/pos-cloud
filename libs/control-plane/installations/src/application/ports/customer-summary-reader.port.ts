/**
 * Installations owns this port (per the cross-bounded-context communication rule: the consumer
 * defines and owns the port it needs - same precedent as CustomerReaderPort in this same
 * directory). The concrete in-process adapter is wired in the composition root (apps/api) - never
 * here.
 *
 * Deliberately separate from CustomerReaderPort: that port answers a single-id ELIGIBILITY
 * question ("is this customer active?") for CreateInstallationUseCase; this one is a purely
 * batched DISPLAY projection consumed by InstallationController to attach a human-readable
 * customer summary to every Installation response, without ever performing one lookup per row.
 * Structurally identical to Licensing's own copy of the same port - see CustomerReaderAdapter's
 * precedent comment for why each bounded context owns its own copy rather than sharing one.
 */
export interface CustomerDisplaySummary {
  readonly id: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string | null;
}

export interface CustomerSummaryReaderPort {
  /** A single batched call for the whole id set - never one call per id. Ids with no matching
   *  Customer are simply absent from the returned map. */
  findByIds(ids: readonly string[]): Promise<Map<string, CustomerDisplaySummary>>;
}

export const CUSTOMER_SUMMARY_READER_PORT = Symbol("INSTALLATIONS_CUSTOMER_SUMMARY_READER_PORT");
