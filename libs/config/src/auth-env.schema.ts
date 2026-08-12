import { z } from "zod";
import { nodeEnvSchema } from "./env.schema";

/**
 * Admin authentication configuration - deliberately kept out of `env.schema.ts`. Only apps/api's
 * auth wiring calls `loadAuthConfig()` (see load-auth-config.ts); apps/worker never touches this
 * schema and its environment does not need to declare any AUTH_* variable.
 */
export const authEnvSchema = z.object({
  // Read independently from envSchema's own NODE_ENV (both read the same underlying process.env,
  // it's not a second source of truth) - only so loadAuthConfig can derive `secureCookies` without
  // access-management (a library) depending on apps/api's app-scoped APP_CONFIG token.
  NODE_ENV: nodeEnvSchema.default("development"),
  // "Minimum 32 bytes effective" is enforced here as a 32-character floor on the raw string, which
  // is a necessary but not sufficient proxy for entropy (a 32-char low-entropy string would still
  // pass). The bootstrap generator (apps/api's admin:bootstrap tooling) always writes a
  // cryptographically random 64-byte secret (hex-encoded, 128 characters) - this floor exists to
  // reject obviously-too-short manual values, not to certify entropy.
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be at least 32 characters"),
  AUTH_JWT_ISSUER: z.string().min(1).default("pos-cloud"),
  AUTH_JWT_AUDIENCE: z.string().min(1).default("pos-cloud-admin"),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).default(900),
  AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(1).default(604800),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default("pos_cloud_admin_refresh"),
});

export type AuthEnvSchema = z.infer<typeof authEnvSchema>;
