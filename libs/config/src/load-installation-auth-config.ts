import { ConfigValidationError } from "./config-validation.error";
import type { InstallationAuthConfig } from "./installation-auth-config";
import { installationAuthEnvSchema } from "./installation-auth-env.schema";

/**
 * Parses and validates installation (machine identity) configuration, separately from
 * `loadConfig()`/`loadAuthConfig()`. Fails fast with a ConfigValidationError (paths + messages only,
 * never raw values) - same discipline as `loadAuthConfig`.
 */
export function loadInstallationAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): InstallationAuthConfig {
  const result = installationAuthEnvSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ConfigValidationError(issues);
  }

  return {
    enrollmentCodeTtlSeconds: result.data.INSTALLATION_ENROLLMENT_TTL_SECONDS,
  };
}
