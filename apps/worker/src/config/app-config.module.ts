import { Global, Module } from "@nestjs/common";
import { loadConfig } from "@pos-cloud/config";
import { APP_CONFIG } from "./app-config.tokens";

/**
 * Loads and validates configuration once, at module-graph construction time - before any other
 * module resolves. An invalid environment throws here, failing the process before it starts
 * connecting to anything.
 */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useValue: loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
