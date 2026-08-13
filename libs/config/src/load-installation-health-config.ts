import { ConfigValidationError } from "./config-validation.error";
import type { InstallationHealthConfig } from "./installation-health-config";
import { installationHealthEnvSchema } from "./installation-health-env.schema";

/**
 * Parses and validates installation heartbeat/health configuration, separately from
 * `loadConfig()`/`loadInstallationAuthConfig()`. Fails fast with a ConfigValidationError (paths +
 * messages only, never raw values) - same discipline as the other `load*Config` functions.
 */
export function loadInstallationHealthConfig(
  env: NodeJS.ProcessEnv = process.env,
): InstallationHealthConfig {
  const result = installationHealthEnvSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ConfigValidationError(issues);
  }

  return {
    heartbeatIntervalSeconds: result.data.INSTALLATION_HEARTBEAT_INTERVAL_SECONDS,
    staleAfterSeconds: result.data.INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS,
    offlineAfterSeconds: result.data.INSTALLATION_HEARTBEAT_OFFLINE_AFTER_SECONDS,
  };
}
