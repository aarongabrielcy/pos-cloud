/**
 * Audit action codes and resource type for this bounded context - the single source of truth so
 * they're never scattered as magic strings across use cases (CLOUD-01C-D, section 37).
 */
export const CUSTOMER_AUDIT_ACTIONS = {
  CREATED: "customer.created",
  STATUS_CHANGED: "customer.status.changed",
} as const;

export const CUSTOMER_AUDIT_RESOURCE_TYPE = "Customer";
