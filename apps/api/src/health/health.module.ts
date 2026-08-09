import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { DatabaseHealthIndicator } from "./database-health.indicator";
import { HealthController } from "./health.controller";
import { RedisHealthIndicator } from "./redis-health.indicator";

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
