import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { Public } from "@pos-cloud/access-management";
import { DatabaseHealthIndicator } from "./database-health.indicator";
import { RedisHealthIndicator } from "./redis-health.indicator";

/**
 * Class-level @Public() (CLOUD-01C-B): every handler here must be reachable with zero credentials -
 * Docker's own HEALTHCHECK and load balancers hit these with no Authorization header at all. See
 * docs/architecture/admin-rbac.md#default-deny for why this must be explicit rather than relying on
 * these routes simply not being annotated (the global guards default-deny anything unannotated).
 */
@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: DatabaseHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /** Confirms only that the process is alive - no dependency is checked here on purpose. */
  @Get("live")
  live(): { status: "ok" } {
    return { status: "ok" };
  }

  /** Real readiness: PostgreSQL and Redis must both answer. Returns 503 when either is down. */
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.database.isDatabaseHealthy("database"),
      () => this.redis.isRedisHealthy("redis"),
    ]);
  }

  /** Aggregate health, equivalent to readiness, kept for operator convenience. */
  @Get()
  @HealthCheck()
  aggregate() {
    return this.health.check([
      () => this.database.isDatabaseHealthy("database"),
      () => this.redis.isRedisHealthy("redis"),
    ]);
  }
}
