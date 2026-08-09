import { Inject, Injectable } from "@nestjs/common";
import { HealthCheckError, type HealthIndicatorResult } from "@nestjs/terminus";
import { pingRedis } from "@pos-cloud/database";
import type { Redis } from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";

@Injectable()
export class RedisHealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async isRedisHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await pingRedis(this.client);
      return { [key]: { status: "up" } };
    } catch (error) {
      throw new HealthCheckError("Redis check failed", {
        [key]: { status: "down", message: (error as Error).message },
      });
    }
  }
}
