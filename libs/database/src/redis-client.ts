import type { AppConfig } from "@pos-cloud/config";
import { Redis } from "ioredis";

/**
 * Creates the single reusable Redis client for a process. `lazyConnect` keeps construction
 * side-effect free so callers control connection lifecycle explicitly (important for readiness
 * checks and graceful shutdown).
 */
export function createRedisClient(redis: AppConfig["redis"]): Redis {
  return new Redis({
    host: redis.host,
    port: redis.port,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}

/** Verifies connectivity via PING. Throws if Redis is unreachable. */
export async function pingRedis(client: Redis): Promise<void> {
  const reply = await client.ping();
  if (reply !== "PONG") {
    throw new Error(`Unexpected Redis PING reply: ${reply}`);
  }
}
