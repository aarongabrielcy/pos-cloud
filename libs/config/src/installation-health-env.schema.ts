import { z } from "zod";

/**
 * Installation heartbeat/health thresholds (CLOUD-01C-D) - deliberately independent of
 * `installation-auth-env.schema.ts`: heartbeat cadence has no relationship to enrollment TTL. See
 * docs/architecture/installation-health.md#config.
 *
 * Defaults (60/120/300s) are sufficient for development - no env edit required to boot.
 */
export const installationHealthEnvSchema = z
  .object({
    INSTALLATION_HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().min(1).default(60),
    INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS: z.coerce.number().int().min(1).default(120),
    INSTALLATION_HEARTBEAT_OFFLINE_AFTER_SECONDS: z.coerce.number().int().min(1).default(300),
  })
  .refine(
    (env) =>
      env.INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS > env.INSTALLATION_HEARTBEAT_INTERVAL_SECONDS,
    {
      message:
        "INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS must be greater than " +
        "INSTALLATION_HEARTBEAT_INTERVAL_SECONDS",
      path: ["INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS"],
    },
  )
  .refine(
    (env) =>
      env.INSTALLATION_HEARTBEAT_OFFLINE_AFTER_SECONDS >
      env.INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS,
    {
      message:
        "INSTALLATION_HEARTBEAT_OFFLINE_AFTER_SECONDS must be greater than " +
        "INSTALLATION_HEARTBEAT_STALE_AFTER_SECONDS",
      path: ["INSTALLATION_HEARTBEAT_OFFLINE_AFTER_SECONDS"],
    },
  );

export type InstallationHealthEnvSchema = z.infer<typeof installationHealthEnvSchema>;
