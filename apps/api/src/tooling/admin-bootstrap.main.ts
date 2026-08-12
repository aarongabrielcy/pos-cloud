import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { BootstrapFirstAdminUseCase } from "@pos-cloud/access-management";
import { AppModule } from "../app.module";

/**
 * `pnpm admin:bootstrap` entry point (see root package.json's admin:bootstrap:internal script and
 * ../../../infra/docker-compose.yml's pos-cloud-admin-bootstrap service). Reads
 * BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD / BOOTSTRAP_ADMIN_DISPLAY_NAME from the process
 * environment only - never written to any .env file, never logged. Creates the first AdminUser and
 * refuses to run again once any AdminUser already exists - see BootstrapFirstAdminUseCase's own
 * comment and docs/architecture/admin-authentication.md#bootstrap.
 *
 * Reuses AppModule wholesale (the same module graph the real API boots) instead of a bespoke
 * minimal module - the extra modules (HealthModule, Customer Management, Licensing, Installations)
 * cost nothing meaningful for a one-shot CLI run, and keeping a second, parallel composition root in
 * sync would be needless maintenance for no real benefit.
 */
async function main(): Promise<void> {
  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL");
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const displayName = requireEnv("BOOTSTRAP_ADMIN_DISPLAY_NAME");

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const bootstrapFirstAdmin = app.get(BootstrapFirstAdminUseCase);
    const result = await bootstrapFirstAdmin.execute({ email, password, displayName });
    console.log(`Admin bootstrap complete: id=${result.id} email=${result.email}`);
  } finally {
    await app.close();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Names only - never echoes any other variable's value.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

main().catch((error: unknown) => {
  // Message only - never error.stack, never the raw error object, so a defensive change deep in
  // the call stack can't accidentally leak a secret into this CLI's output.
  console.error(
    `Admin bootstrap failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
