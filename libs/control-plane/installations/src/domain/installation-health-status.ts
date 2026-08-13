/**
 * Operational health - deliberately a separate concept from InstallationStatus (lifecycle). Never
 * merged into InstallationStatus, never persisted (see computeInstallationHealth): "ACTIVE +
 * OFFLINE" is a valid, common combination, not a contradiction. See
 * docs/architecture/installation-health.md#lifecycle-vs-health.
 */
export enum InstallationHealthStatus {
  /** No heartbeat has ever been recorded - either PENDING (structurally impossible to have one
   * yet, no credential exists) or ACTIVE but the POS app hasn't reported in yet. */
  NEVER_SEEN = "NEVER_SEEN",
  ONLINE = "ONLINE",
  STALE = "STALE",
  OFFLINE = "OFFLINE",
}
