/**
 * Audit action codes and resource type for this bounded context - the single source of truth so
 * they're never scattered as magic strings across use cases (CLOUD-01C-D, section 37).
 */
export const INSTALLATION_AUDIT_ACTIONS = {
  CREATED: "installation.created",
  STATUS_CHANGED: "installation.status.changed",
  ENROLLMENT_ISSUED: "installation.enrollment.issued",
  ENROLLMENT_CONSUMED: "installation.enrollment.consumed",
  CREDENTIAL_REVOKED: "installation.credential.revoked",
} as const;

export const INSTALLATION_AUDIT_RESOURCE_TYPE = "Installation";
