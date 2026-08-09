import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535);

export const nodeEnvSchema = z.enum(["development", "test", "staging", "production"]);
export const logLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace"]);

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default("development"),
  APP_NAME: z.string().min(1).default("pos-cloud"),
  // Optional: only apps/api listens on a port. apps/worker's env has no APP_PORT and never reads
  // config.app.port, so this must not be a hard requirement for every process.
  APP_PORT: port.default(3000),

  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: port,
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),

  REDIS_HOST: z.string().min(1),
  REDIS_PORT: port,

  LOG_LEVEL: logLevelSchema.default("info"),
});

export type EnvSchema = z.infer<typeof envSchema>;
