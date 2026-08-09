import { Global, Inject, Logger, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { AppConfig } from "@pos-cloud/config";
import { createRedisClient } from "@pos-cloud/database";
import type { Redis } from "ioredis";
import { APP_CONFIG } from "../config/app-config.tokens";
import { REDIS_CLIENT } from "./redis.constants";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createRedisClient(config.redis),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        `Initial Redis connection failed; ioredis will keep retrying in the background: ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => {
      this.client.disconnect();
    });
  }
}
