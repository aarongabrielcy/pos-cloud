export interface RecordHeartbeatInput {
  readonly installationId: string;
  readonly receivedAt: Date;
  readonly appVersion: string;
  readonly clientReportedAt: Date | null;
}

/**
 * Write side of installation_health - a single current-state row per installation (no history, see
 * docs/architecture/installation-health.md#no-heartbeat-history). The real adapter must perform
 * `recordHeartbeat` as one atomic upsert (INSERT ... ON CONFLICT DO UPDATE), never a
 * read-then-write, so concurrent/out-of-order heartbeats can never race or regress `lastSeenAt`,
 * `appVersion`, or `clientReportedAt` - see TypeOrmInstallationHealthRepository.
 */
export interface InstallationHealthWriterPort {
  recordHeartbeat(input: RecordHeartbeatInput): Promise<void>;
}

export const INSTALLATION_HEALTH_WRITER = Symbol("INSTALLATION_HEALTH_WRITER");
