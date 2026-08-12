import { z } from "zod";

/**
 * Installation (machine identity) configuration - deliberately kept separate from
 * `auth-env.schema.ts` (AdminUser authentication). See docs/architecture/
 * installation-enrollment.md#config: the two identity planes' lifecycles must never be coupled, so
 * this schema does not read or default from any AUTH_* variable.
 */
export const installationAuthEnvSchema = z.object({
  INSTALLATION_ENROLLMENT_TTL_SECONDS: z.coerce.number().int().min(1).default(900),
});

export type InstallationAuthEnvSchema = z.infer<typeof installationAuthEnvSchema>;
