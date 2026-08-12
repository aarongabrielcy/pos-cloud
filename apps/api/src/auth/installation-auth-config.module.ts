import { Global, Module } from "@nestjs/common";
import { INSTALLATION_AUTH_CONFIG, loadInstallationAuthConfig } from "@pos-cloud/config";

/**
 * Loads and validates installation (machine identity) configuration once, separately from
 * AuthConfigModule - see @pos-cloud/config's `loadInstallationAuthConfig` for why this is not folded
 * into AUTH_CONFIG (installation identity must never be coupled to AdminUser identity's
 * configuration lifecycle).
 */
@Global()
@Module({
  providers: [{ provide: INSTALLATION_AUTH_CONFIG, useValue: loadInstallationAuthConfig() }],
  exports: [INSTALLATION_AUTH_CONFIG],
})
export class InstallationAuthConfigModule {}
