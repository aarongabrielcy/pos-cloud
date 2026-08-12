import type { AuthConfig } from "./auth-config";
import { authEnvSchema } from "./auth-env.schema";
import { ConfigValidationError } from "./config-validation.error";

/**
 * Parses and validates admin authentication configuration, separately from `loadConfig()`. Only
 * called by processes that actually need auth (apps/api's auth wiring) - apps/worker's environment
 * never needs to declare AUTH_JWT_SECRET, so this must not be folded into the always-loaded
 * envSchema. Fails fast with a ConfigValidationError (paths + messages only, never raw values).
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const result = authEnvSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ConfigValidationError(issues);
  }

  const parsed = result.data;

  return {
    jwt: {
      secret: parsed.AUTH_JWT_SECRET,
      issuer: parsed.AUTH_JWT_ISSUER,
      audience: parsed.AUTH_JWT_AUDIENCE,
    },
    accessTokenTtlSeconds: parsed.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: parsed.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    refreshCookieName: parsed.AUTH_REFRESH_COOKIE_NAME,
    secureCookies: parsed.NODE_ENV === "production",
  };
}
