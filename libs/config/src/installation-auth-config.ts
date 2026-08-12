export interface InstallationAuthConfig {
  readonly enrollmentCodeTtlSeconds: number;
}

/** DI token for injecting InstallationAuthConfig in frameworks (e.g. NestJS) that resolve by token. */
export const INSTALLATION_AUTH_CONFIG = Symbol("INSTALLATION_AUTH_CONFIG");
