export interface InstallationHealthSnapshot {
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly appVersion: string;
  readonly clientReportedAt: Date | null;
}

/**
 * Read side of installation_health, for the single-installation admin health detail view. `null`
 * means no heartbeat row exists yet (NEVER_SEEN) - see GetInstallationHealthUseCase. The list view
 * (ListInstallationsUseCase) does not use this port - it reads the same table via a single
 * LEFT JOIN in InstallationRepository.list() instead, to avoid N+1.
 */
export interface InstallationHealthReaderPort {
  findByInstallationId(installationId: string): Promise<InstallationHealthSnapshot | null>;
}

export const INSTALLATION_HEALTH_READER = Symbol("INSTALLATION_HEALTH_READER");
