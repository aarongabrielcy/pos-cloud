/**
 * Audit action codes and resource type for this bounded context - the single source of truth so
 * they're never scattered as magic strings across use cases (CLOUD-01C-D, section 37).
 */
export const LICENSE_AUDIT_ACTIONS = {
  CREATED: "license.created",
  STATUS_CHANGED: "license.status.changed",
  ENTITLEMENTS_REPLACED: "license.entitlements.replaced",
} as const;

export const LICENSE_AUDIT_RESOURCE_TYPE = "License";
