import type { AppConfig } from "./app-config";
import { ConfigValidationError } from "./config-validation.error";
import { envSchema } from "./env.schema";

/**
 * Parses and validates process environment variables into a typed, centralized AppConfig.
 * Fails fast with a ConfigValidationError (paths + messages only, never raw values) so secrets
 * are never echoed back in error output.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ConfigValidationError(issues);
  }

  const parsed = result.data;

  return {
    env: parsed.NODE_ENV,
    app: {
      name: parsed.APP_NAME,
      port: parsed.APP_PORT,
    },
    database: {
      host: parsed.DATABASE_HOST,
      port: parsed.DATABASE_PORT,
      name: parsed.DATABASE_NAME,
      user: parsed.DATABASE_USER,
      password: parsed.DATABASE_PASSWORD,
    },
    redis: {
      host: parsed.REDIS_HOST,
      port: parsed.REDIS_PORT,
    },
    logging: {
      level: parsed.LOG_LEVEL,
    },
  };
}
