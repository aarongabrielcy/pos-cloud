import { Module } from "@nestjs/common";
import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./observability/logging.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [AppConfigModule, LoggingModule, DatabaseModule, RedisModule, HealthModule],
})
export class AppModule {}
