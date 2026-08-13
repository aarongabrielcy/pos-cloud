import { InstallationHealthStatus } from "./installation-health-status";
import { InstallationStatus } from "./installation-status";

/**
 * Framework-free thresholds, structurally mirroring `@pos-cloud/config`'s InstallationHealthConfig
 * but declared locally - Domain must never import an infrastructure-adjacent config package (see
 * ADR-002). The application layer reads the real config and passes these two fields through.
 */
export interface InstallationHealthThresholds {
  readonly staleAfterSeconds: number;
  readonly offlineAfterSeconds: number;
}

/**
 * The single source of truth for lifecycle+heartbeat -> operational health. Called from every read
 * path (list, single detail) so SQL and TypeScript never duplicate this logic and can never diverge -
 * see docs/architecture/installation-health.md#health-model.
 *
 * SUSPENDED/DECOMMISSIONED always report OFFLINE regardless of lastSeenAt recency:
 * InstallationAuthGuard already rejects heartbeats from both (403) before any use case runs, so
 * their lastSeenAt is frozen at the moment of suspension - without this override, an installation
 * suspended seconds after a heartbeat would misleadingly show ONLINE next to SUSPENDED.
 */
export function computeInstallationHealth(
  lifecycleStatus: InstallationStatus,
  lastSeenAt: Date | null,
  now: Date,
  thresholds: InstallationHealthThresholds,
): InstallationHealthStatus {
  if (
    lifecycleStatus === InstallationStatus.SUSPENDED ||
    lifecycleStatus === InstallationStatus.DECOMMISSIONED
  ) {
    return InstallationHealthStatus.OFFLINE;
  }

  if (lastSeenAt === null) {
    // PENDING can never reach here with a non-null lastSeenAt - no credential exists pre-activation,
    // so a heartbeat is structurally impossible until ACTIVE.
    return InstallationHealthStatus.NEVER_SEEN;
  }

  const ageSeconds = (now.getTime() - lastSeenAt.getTime()) / 1000;

  if (ageSeconds < thresholds.staleAfterSeconds) {
    return InstallationHealthStatus.ONLINE;
  }
  if (ageSeconds < thresholds.offlineAfterSeconds) {
    return InstallationHealthStatus.STALE;
  }
  return InstallationHealthStatus.OFFLINE;
}
