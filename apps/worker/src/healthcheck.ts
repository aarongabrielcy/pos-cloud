import "reflect-metadata";
import { loadConfig } from "@pos-cloud/config";
import {
  createDataSource,
  createRedisClient,
  pingDataSource,
  pingRedis,
} from "@pos-cloud/database";

/**
 * Standalone readiness check for `docker compose` / `HEALTHCHECK`. Deliberately does not boot
 * Nest or open an HTTP port - it just verifies PostgreSQL and Redis are reachable and exits with
 * 0 (healthy) or 1 (unhealthy). Never prints connection secrets, only generic error messages.
 */
async function main(): Promise<void> {
  const config = loadConfig();

  const dataSource = createDataSource(config.database);
  const redis = createRedisClient(config.redis);

  try {
    await dataSource.initialize();
    await pingDataSource(dataSource);

    await redis.connect();
    await pingRedis(redis);

    process.exit(0);
  } catch (error) {
    process.stderr.write(`Worker healthcheck failed: ${(error as Error).message}\n`);
    process.exit(1);
  } finally {
    await dataSource.destroy().catch(() => undefined);
    redis.disconnect();
  }
}

main();
