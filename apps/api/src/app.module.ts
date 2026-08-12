import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { AppConfigModule } from "./config/app-config.module";
import { ControlPlaneModule } from "./control-plane/control-plane.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./observability/logging.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    ControlPlaneModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
