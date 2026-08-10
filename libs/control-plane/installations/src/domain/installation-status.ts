export enum InstallationStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  DECOMMISSIONED = "DECOMMISSIONED",
}

/**
 * Administrative transitions only - deliberately excludes PENDING -> ACTIVE. Real activation
 * (PENDING -> ACTIVE) is a distinct domain operation, `Installation.activate()`, reserved for
 * CLOUD-01C's installation credential/activation flow. No admin endpoint may reach ACTIVE from
 * PENDING through this table. DECOMMISSIONED is terminal.
 */
const ALLOWED_ADMIN_TRANSITIONS: Readonly<
  Record<InstallationStatus, readonly InstallationStatus[]>
> = {
  [InstallationStatus.PENDING]: [InstallationStatus.DECOMMISSIONED],
  [InstallationStatus.ACTIVE]: [InstallationStatus.SUSPENDED, InstallationStatus.DECOMMISSIONED],
  [InstallationStatus.SUSPENDED]: [InstallationStatus.ACTIVE, InstallationStatus.DECOMMISSIONED],
  [InstallationStatus.DECOMMISSIONED]: [],
};

export function isInstallationAdminTransitionAllowed(
  from: InstallationStatus,
  to: InstallationStatus,
): boolean {
  return ALLOWED_ADMIN_TRANSITIONS[from].includes(to);
}
