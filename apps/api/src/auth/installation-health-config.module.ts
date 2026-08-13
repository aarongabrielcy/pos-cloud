import { Global, Module } from "@nestjs/common";
import { INSTALLATION_HEALTH_CONFIG, loadInstallationHealthConfig } from "@pos-cloud/config";

/**
 * Loads and validates installation heartbeat/health threshold configuration once, separately from
 * every other config module - see @pos-cloud/config's `loadInstallationHealthConfig`. Heartbeat
 * cadence has no relationship to enrollment TTL or admin session TTLs, so it is not folded into
 * either.
 */
@Global()
@Module({
  providers: [{ provide: INSTALLATION_HEALTH_CONFIG, useValue: loadInstallationHealthConfig() }],
  exports: [INSTALLATION_HEALTH_CONFIG],
})
export class InstallationHealthConfigModule {}
