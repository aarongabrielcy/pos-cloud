export interface InstallationHealthConfig {
  readonly heartbeatIntervalSeconds: number;
  readonly staleAfterSeconds: number;
  readonly offlineAfterSeconds: number;
}

/** DI token for injecting InstallationHealthConfig in frameworks (e.g. NestJS) that resolve by token. */
export const INSTALLATION_HEALTH_CONFIG = Symbol("INSTALLATION_HEALTH_CONFIG");
