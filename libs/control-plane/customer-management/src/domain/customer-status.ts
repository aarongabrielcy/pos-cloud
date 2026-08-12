export enum CustomerStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  INACTIVE = "INACTIVE",
}

/**
 * ACTIVE <-> SUSPENDED, both -> INACTIVE. INACTIVE is terminal - no reactivation in this version.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<CustomerStatus, readonly CustomerStatus[]>> = {
  [CustomerStatus.ACTIVE]: [CustomerStatus.SUSPENDED, CustomerStatus.INACTIVE],
  [CustomerStatus.SUSPENDED]: [CustomerStatus.ACTIVE, CustomerStatus.INACTIVE],
  [CustomerStatus.INACTIVE]: [],
};

export function isCustomerStatusTransitionAllowed(
  from: CustomerStatus,
  to: CustomerStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
