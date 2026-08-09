import { Global, Inject, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { AppConfig } from "@pos-cloud/config";
import { createRedisClient } from "@pos-cloud/database";
import type { Redis } from "ioredis";
import { PinoLogger } from "nestjs-pino";
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
  constructor(
    @Inject(REDIS_CLIENT) private readonly client: Redis,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RedisModule.name);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        { err: (error as Error).message },
        "Initial Redis connection failed; ioredis will keep retrying in the background",
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => {
      this.client.disconnect();
    });
  }
}
