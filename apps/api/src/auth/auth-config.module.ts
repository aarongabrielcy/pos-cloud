import { Global, Module } from "@nestjs/common";
import { AUTH_CONFIG, loadAuthConfig } from "@pos-cloud/config";

/**
 * Loads and validates admin authentication configuration once, separately from AppConfigModule -
 * only apps/api needs AUTH_JWT_SECRET/etc (see @pos-cloud/config's loadAuthConfig for why this is
 * not folded into loadConfig()/AppConfigModule, and CLOUD-01C-A's brief section 12: the worker must
 * never receive AUTH_JWT_SECRET).
 */
@Global()
@Module({
  providers: [{ provide: AUTH_CONFIG, useValue: loadAuthConfig() }],
  exports: [AUTH_CONFIG],
})
export class AuthConfigModule {}
